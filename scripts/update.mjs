import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildArtifacts} from './build.mjs';
import {createGitHubClient, mapLimit} from './lib/github.mjs';
import {refreshDeveloperProfiles, updateTranslationCache} from './lib/enrichment.mjs';
import {
  normalizeApiProject,
  normalizeRefreshedProject,
  plannedGitHubRequestCeiling,
  reconcileCatalogs,
  relevanceEvidence,
  selectProjectsForRefresh,
  snapshotFromProjects,
  toNumber,
  validateRadarConfig
} from './lib/radar.mjs';
import {
  loadSnapshotRecords,
  pruneArchiveSnapshots,
  pruneHourlySnapshots,
  shanghaiDate,
  snapshotFilename
} from './lib/snapshots.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async relative => JSON.parse(await fs.readFile(path.join(root, relative), 'utf8'));
const writeJsonAtomic = async (relative, value) => {
  const target = path.join(root, relative);
  const temporary = path.join(path.dirname(target), `.tmp-${path.basename(target)}-${process.pid}`);
  await fs.mkdir(path.dirname(target), {recursive: true});
  try {
    await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
    await fs.rename(temporary, target);
  } finally {
    await fs.rm(temporary, {force: true});
  }
};

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';

function daysAgoDate(days) {
  return shanghaiDate(new Date(Date.now() - days * 86_400_000));
}

const now = new Date().toISOString();
const [config, projectsPayload, candidatesPayload, exclusionsPayload, developerPayload, translationPayload, allowlist, denylist] = await Promise.all([
  readJson('config/radar.json'),
  readJson('data/projects.json'),
  readJson('data/candidates.json'),
  readJson('data/exclusions.json'),
  readJson('data/developers.json'),
  readJson('data/translations.json'),
  readJson('config/manual-allowlist.json'),
  readJson('config/manual-denylist.json')
]);
const configurationErrors = validateRadarConfig(config);
if (configurationErrors.length) throw new Error(`Invalid radar config:\n${configurationErrors.join('\n')}`);
const repositoryPattern = /^[^/\s]+\/[^/\s]+$/;
for (const [label, value] of [
  ['projects', projectsPayload.projects],
  ['candidates', candidatesPayload.candidates],
  ['exclusions', exclusionsPayload.exclusions],
  ['allowlist', allowlist.repositories],
  ['denylist', denylist.repositories]
]) {
  if (!Array.isArray(value)) throw new Error(`${label} payload must be an array`);
}
const plannedRequestCeiling = plannedGitHubRequestCeiling(config, allowlist.repositories.length);
if (plannedRequestCeiling > config.api_request_budget_per_run) {
  throw new Error(`Planned GitHub API work (${plannedRequestCeiling}) exceeds per-run budget (${config.api_request_budget_per_run})`);
}
for (const [label, repositories] of [['allowlist', allowlist.repositories], ['denylist', denylist.repositories]]) {
  const invalid = repositories.find(repository => typeof repository !== 'string' || !repositoryPattern.test(repository));
  if (invalid) throw new Error(`${label} contains an invalid owner/repo entry: ${String(invalid)}`);
}
if (!developerPayload?.profiles || typeof developerPayload.profiles !== 'object' || Array.isArray(developerPayload.profiles)) {
  throw new Error('developer profiles payload must be an object');
}
if (!translationPayload?.translations || typeof translationPayload.translations !== 'object' || Array.isArray(translationPayload.translations)) {
  throw new Error('translations payload must be an object');
}
const github = createGitHubClient({
  token,
  maxAttempts: config.api_max_attempts,
  maxRetryDelayMs: config.api_max_retry_delay_ms
});

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
  if (!item) throw new Error(`Manual allowlist repository is unavailable: ${repo}`);
  if (Date.parse(item.created_at) <= Date.parse(config.release_cutoff_utc)) {
    throw new Error(`Manual allowlist repository predates the research cutoff: ${repo}`);
  }
  discovered.set(item.full_name.toLowerCase(), {...item, manual_allowlist: true, discovery_queries: ['manual-allowlist']});
}

const refreshTargets = selectProjectsForRefresh([...existing.values()], {
  limit: config.max_existing_refresh_per_run,
  priorityLimit: config.priority_existing_refresh_per_run
});
const refreshedProjectPairs = await mapLimit(refreshTargets, 6, async project => {
  const api = await github(`/repos/${project.repo}`, {allow404: true});
  const refreshed = api
    ? normalizeRefreshedProject(api, project, now)
    : {project: {...project, status: 'unavailable', last_checked_at: now}, identityChanged: false};
  return [project.repo.toLowerCase(), refreshed];
});
const refreshedByRepository = new Map(refreshedProjectPairs);
const refreshedExisting = [];
const identityChangeEvaluations = [];
for (const project of existing.values()) {
  const refreshed = refreshedByRepository.get(project.repo.toLowerCase()) || {project, identityChanged: false};
  if (refreshed.identityChanged) {
    identityChangeEvaluations.push({
      project: refreshed.project,
      discovery_queries: ['repository-identity-change']
    });
  } else {
    refreshedExisting.push(refreshed.project);
  }
}
const existingKeys = new Set(refreshedExisting.map(project => project.repo.toLowerCase()));

const newDiscoveries = [...discovered.values()]
  .filter(item => !existingKeys.has(item.full_name.toLowerCase()))
  .filter(item => !denied.has(item.full_name.toLowerCase()))
  .filter(item => item.created_at && Date.parse(item.created_at) > Date.parse(config.release_cutoff_utc))
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
const evaluated = [...identityChangeEvaluations, ...evaluatedWithReadmes, ...evaluatedWithoutReadmes];
const {projects, candidates, exclusions, reconciliation} = reconcileCatalogs({
  projects: refreshedExisting,
  candidates: candidatesPayload.candidates,
  exclusions: exclusionsPayload.exclusions,
  evaluated,
  denylist: denylist.repositories,
  releaseCutoffUtc: config.release_cutoff_utc,
  observedAt: now
});
const trackedProjects = [...projects, ...candidates];
const [developerResult, translationResult] = await Promise.all([
  refreshDeveloperProfiles(trackedProjects, developerPayload, {
    github,
    observedAt: now,
    refreshDays: config.developer_profile_refresh_days,
    maxRefreshes: config.max_developer_refresh_per_run
  }),
  updateTranslationCache(trackedProjects, translationPayload, {
    token,
    model: config.translation_model,
    batchSize: config.translation_batch_size,
    maxItems: config.max_translation_items_per_run,
    maxAttempts: config.translation_max_attempts,
    observedAt: now
  })
]);
const snapshot = snapshotFromProjects(projects, now);
const hourlySnapshotPath = `data/snapshots/${snapshotFilename('hourly', now)}`;
const dailyArchivePath = `data/archive/${snapshotFilename('archive', now)}`;

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
  writeJsonAtomic('data/developers.json', developerResult.payload),
  writeJsonAtomic('data/translations.json', translationResult.payload),
  writeJsonAtomic(hourlySnapshotPath, snapshot),
  writeJsonAtomic(dailyArchivePath, snapshot)
]);

const snapshotRecords = await loadSnapshotRecords(root);
const prunedSnapshots = await pruneHourlySnapshots(
  root,
  snapshotRecords,
  now,
  config.hourly_snapshot_retention_days,
);
const prunedArchives = await pruneArchiveSnapshots(
  root,
  snapshotRecords,
  now,
  config.daily_archive_retention_days,
);
await buildArtifacts();
console.log(JSON.stringify({
  updated_at: now,
  projects: projects.length,
  candidates: candidates.length,
  exclusions: exclusions.length,
  hourly_snapshot: hourlySnapshotPath,
  daily_archive: dailyArchivePath,
  pruned_hourly_snapshots: prunedSnapshots.length,
  pruned_daily_archives: prunedArchives.length,
  repository_refresh: {
    tracked: existing.size,
    refreshed: refreshTargets.length,
    deferred: Math.max(0, existing.size - refreshTargets.length),
    priority: Math.min(config.priority_existing_refresh_per_run, refreshTargets.length)
  },
  repository_identity_changes: identityChangeEvaluations.length,
  catalog_reconciliation: reconciliation,
  planned_github_api_request_ceiling: plannedRequestCeiling,
  developer_profiles: developerResult.stats,
  translations: translationResult.stats
}));
