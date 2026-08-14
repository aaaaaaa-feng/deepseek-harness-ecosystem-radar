import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildArtifacts} from './build.mjs';
import {
  normalizeApiProject,
  relevanceEvidence,
  snapshotFromProjects,
  toNumber
} from './lib/radar.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async relative => JSON.parse(await fs.readFile(path.join(root, relative), 'utf8'));
const writeJsonAtomic = async (relative, value) => {
  const target = path.join(root, relative);
  const temporary = path.join(path.dirname(target), `.tmp-${path.basename(target)}-${process.pid}`);
  await fs.mkdir(path.dirname(target), {recursive: true});
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await fs.rename(temporary, target);
};

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const headers = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'deepseek-harness-ecosystem-radar'
};
if (token) headers.Authorization = `Bearer ${token}`;

async function github(pathname, options = {}) {
  const response = await fetch(`https://api.github.com${pathname}`, {
    headers: {...headers, ...(options.headers || {})}
  });
  if (response.status === 404 && options.allow404) return null;
  if (!response.ok) {
    const body = (await response.text()).slice(0, 500);
    const remaining = response.headers.get('x-ratelimit-remaining');
    throw new Error(`GitHub API ${response.status} for ${pathname}; remaining=${remaining ?? 'unknown'}; ${body}`);
  }
  return options.raw ? response.text() : response.json();
}

async function mapLimit(items, limit, worker) {
  const output = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const index = next++;
      output[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({length: Math.min(limit, items.length)}, run));
  return output;
}

function shanghaiDate(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(value);
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function daysAgoDate(days) {
  return shanghaiDate(new Date(Date.now() - days * 86_400_000));
}

const now = new Date().toISOString();
const [config, projectsPayload, candidatesPayload, exclusionsPayload, allowlist, denylist] = await Promise.all([
  readJson('config/radar.json'),
  readJson('data/projects.json'),
  readJson('data/candidates.json'),
  readJson('data/exclusions.json'),
  readJson('config/manual-allowlist.json'),
  readJson('config/manual-denylist.json')
]);

const denied = new Set(denylist.repositories.map(repo => repo.toLowerCase()));
const existing = new Map(projectsPayload.projects.map(project => [project.repo.toLowerCase(), project]));
const discovered = new Map();

for (const template of config.queries) {
  const query = template.replaceAll('{since_date}', daysAgoDate(config.discovery_lookback_days));
  for (let page = 1; page <= config.search_pages_per_query; page += 1) {
    const params = new URLSearchParams({q: query, per_page: '100', page: String(page), sort: 'updated', order: 'desc'});
    const result = await github(`/search/repositories?${params}`);
    for (const item of result.items || []) {
      const key = item.full_name.toLowerCase();
      const previous = discovered.get(key);
      discovered.set(key, {
        ...item,
        discovery_queries: [...new Set([...(previous?.discovery_queries || []), query])]
      });
    }
    if ((result.items || []).length < 100) break;
  }
}

for (const repo of allowlist.repositories) {
  const item = await github(`/repos/${repo}`, {allow404: true});
  if (item) discovered.set(item.full_name.toLowerCase(), {...item, manual_allowlist: true, discovery_queries: ['manual-allowlist']});
}

const refreshedExisting = await mapLimit([...existing.values()], 6, async project => {
  const api = await github(`/repos/${project.repo}`, {allow404: true});
  if (!api) return {...project, status: 'unavailable', last_checked_at: now};
  return normalizeApiProject(api, project, {}, now);
});
const nextProjects = new Map(refreshedExisting.map(project => [project.repo.toLowerCase(), project]));

const newDiscoveries = [...discovered.values()]
  .filter(item => !nextProjects.has(item.full_name.toLowerCase()))
  .filter(item => !denied.has(item.full_name.toLowerCase()))
  .filter(item => item.created_at && item.created_at > config.release_cutoff_utc)
  .sort((a, b) => Number(Boolean(b.manual_allowlist)) - Number(Boolean(a.manual_allowlist)) || toNumber(b.stargazers_count) - toNumber(a.stargazers_count) || b.created_at.localeCompare(a.created_at));

const readmeTargets = newDiscoveries.slice(0, config.max_readmes_per_run);
const evaluatedWithReadmes = await mapLimit(readmeTargets, 5, async item => {
  const readme = await github(`/repos/${item.full_name}/readme`, {
    allow404: true,
    raw: true,
    headers: {Accept: 'application/vnd.github.raw+json'}
  }) || '';
  const evidence = item.manual_allowlist
    ? {level: 'confirmed', reason: '维护者手动白名单'}
    : relevanceEvidence(item, readme);
  const project = normalizeApiProject(item, {}, {
    ...evidence,
    verification: readme ? 'readme-evidence-not-runtime-tested' : 'metadata-only',
    url: `https://github.com/${item.full_name}#readme`
  }, now);
  if (item.fork && evidence.level === 'confirmed' && !item.manual_allowlist) {
    project.evidence_level = 'candidate';
    project.evidence_reason = 'Fork 仓库需要确认是否存在独立实现';
  }
  return {project, discovery_queries: item.discovery_queries || []};
});
const evaluatedWithoutReadmes = newDiscoveries.slice(config.max_readmes_per_run).map(item => {
  const evidence = item.manual_allowlist
    ? {level: 'confirmed', reason: '维护者手动白名单'}
    : relevanceEvidence(item);
  const project = normalizeApiProject(item, {}, {
    ...evidence,
    verification: 'metadata-only',
    url: `https://github.com/${item.full_name}`
  }, now);
  if (item.fork && evidence.level === 'confirmed' && !item.manual_allowlist) {
    project.evidence_level = 'candidate';
    project.evidence_reason = 'Fork 仓库需要确认是否存在独立实现';
  }
  return {project, discovery_queries: item.discovery_queries || []};
});
const evaluated = [...evaluatedWithReadmes, ...evaluatedWithoutReadmes];

const candidateMap = new Map(candidatesPayload.candidates.map(candidate => [candidate.repo.toLowerCase(), candidate]));
const exclusionMap = new Map(exclusionsPayload.exclusions.map(item => [item.repo.toLowerCase(), item]));
for (const {project, discovery_queries} of evaluated) {
  const key = project.repo.toLowerCase();
  if (project.evidence_level === 'confirmed') {
    nextProjects.set(key, {...project, discovery_queries});
    candidateMap.delete(key);
    exclusionMap.delete(key);
  } else if (project.evidence_level === 'candidate') {
    candidateMap.set(key, {
      ...candidateMap.get(key),
      ...project,
      discovery_queries,
      first_seen_at: candidateMap.get(key)?.first_seen_at || now,
      last_seen_at: now
    });
  } else {
    exclusionMap.set(key, {
      repo: project.repo,
      url: project.url,
      reason: project.evidence_reason,
      discovered_at: now,
      discovery_queries
    });
  }
}

const projects = [...nextProjects.values()].sort((a, b) => toNumber(b.stars) - toNumber(a.stars) || a.repo.localeCompare(b.repo));
const candidates = [...candidateMap.values()].sort((a, b) => toNumber(b.stars) - toNumber(a.stars) || a.repo.localeCompare(b.repo));
const exclusions = [...exclusionMap.values()].sort((a, b) => a.repo.localeCompare(b.repo));
const snapshot = snapshotFromProjects(projects, now);

await Promise.all([
  writeJsonAtomic('data/projects.json', {
    schema_version: 1,
    generated_at: now,
    release_cutoff_utc: config.release_cutoff_utc,
    source: 'github-api',
    projects
  }),
  writeJsonAtomic('data/candidates.json', {schema_version: 1, generated_at: now, candidates}),
  writeJsonAtomic('data/exclusions.json', {schema_version: 1, generated_at: now, exclusions}),
  writeJsonAtomic(`data/snapshots/${shanghaiDate()}.json`, snapshot)
]);

await buildArtifacts();
console.log(JSON.stringify({updated_at: now, projects: projects.length, candidates: candidates.length, exclusions: exclusions.length}));
