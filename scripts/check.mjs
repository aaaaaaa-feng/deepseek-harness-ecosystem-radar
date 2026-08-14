import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateProjectSet, validateRadarConfig} from './lib/radar.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async relative => JSON.parse(await fs.readFile(path.join(root, relative), 'utf8'));
const keySet = items => new Set(items.map(item => item.repo.toLowerCase()));
const duplicates = values => {
  const seen = new Set();
  const repeated = new Set();
  for (const value of values.map(item => item.toLowerCase())) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated];
};
const intersect = (left, right) => [...left].filter(value => right.has(value));

function shanghaiDate(value) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date(value));
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

const [config, projects, candidates, exclusions, rankings, latest, docsLatest, allowlist, denylist] = await Promise.all([
  readJson('config/radar.json'),
  readJson('data/projects.json'),
  readJson('data/candidates.json'),
  readJson('data/exclusions.json'),
  readJson('data/rankings.json'),
  readJson('data/latest.json'),
  readJson('docs/data/latest.json'),
  readJson('config/manual-allowlist.json'),
  readJson('config/manual-denylist.json')
]);

const errors = [
  ...validateRadarConfig(config),
  ...validateProjectSet(projects.projects, config.release_cutoff_utc)
];
const active = projects.projects.filter(project => project.status === 'active' && project.evidence_level === 'confirmed');
const projectKeys = keySet(projects.projects);
const candidateKeys = keySet(candidates.candidates);
const exclusionKeys = keySet(exclusions.exclusions);
const denied = new Set(denylist.repositories.map(repo => repo.toLowerCase()));
const repositoryPattern = /^[^/\s]+\/[^/\s]+$/;

for (const duplicate of duplicates(allowlist.repositories)) errors.push(`Duplicate allowlist entry: ${duplicate}`);
for (const duplicate of duplicates(denylist.repositories)) errors.push(`Duplicate denylist entry: ${duplicate}`);
for (const repository of allowlist.repositories) if (!repositoryPattern.test(repository)) errors.push(`Invalid allowlist entry: ${repository}`);
for (const repository of denylist.repositories) if (!repositoryPattern.test(repository)) errors.push(`Invalid denylist entry: ${repository}`);
for (const overlap of intersect(new Set(allowlist.repositories.map(repo => repo.toLowerCase())), denied)) errors.push(`Allowlist and denylist overlap: ${overlap}`);
for (const overlap of intersect(projectKeys, candidateKeys)) errors.push(`Project also present as candidate: ${overlap}`);
for (const overlap of intersect(projectKeys, exclusionKeys)) errors.push(`Project also present as exclusion: ${overlap}`);
for (const overlap of intersect(candidateKeys, exclusionKeys)) errors.push(`Candidate also present as exclusion: ${overlap}`);
for (const overlap of intersect(projectKeys, denied)) errors.push(`Denylisted project remains confirmed: ${overlap}`);
for (const overlap of intersect(candidateKeys, denied)) errors.push(`Denylisted project remains a candidate: ${overlap}`);

if (rankings.current.length !== active.length) errors.push('Ranking count does not match active confirmed projects');
if (latest.summary.confirmed_projects !== active.length) errors.push('Latest summary count mismatch');
if (latest.summary.candidate_projects !== candidates.candidates.length) errors.push('Latest candidate count mismatch');
if (latest.summary.snapshots < 1) errors.push('Snapshot count must be positive');
if (latest.generated_at !== rankings.generated_at) errors.push('Latest and rankings timestamps differ');
if (latest.projects.length !== active.length) errors.push('Latest project payload count mismatch');
if (JSON.stringify(latest) !== JSON.stringify(docsLatest)) errors.push('docs/data/latest.json is not synchronized');
if (projects.projects.some(project => project.repo === 'unitarylab/quantum-practices')) errors.push('Known false positive is present');

const rankedRepos = new Set();
for (const [index, item] of rankings.current.entries()) {
  if (item.rank !== index + 1) errors.push(`Non-contiguous ranking at ${item.repo}`);
  if (rankedRepos.has(item.repo.toLowerCase())) errors.push(`Duplicate ranking repository: ${item.repo}`);
  rankedRepos.add(item.repo.toLowerCase());
  if (!Number.isFinite(item.attention_score)) errors.push(`Invalid score at ${item.repo}`);
  if (!Number.isFinite(item.stars) || !Number.isFinite(item.forks)) errors.push(`Invalid metrics at ${item.repo}`);
}
for (const project of active) {
  if (!rankedRepos.has(project.repo.toLowerCase())) errors.push(`Active project missing from rankings: ${project.repo}`);
}

const snapshotNames = (await fs.readdir(path.join(root, 'data/snapshots')))
  .filter(name => name.endsWith('.json'))
  .sort();
if (snapshotNames.length !== latest.summary.snapshots) errors.push('Snapshot file count mismatch');
for (const name of snapshotNames) {
  if (!/^\d{4}-\d{2}-\d{2}\.json$/.test(name)) {
    errors.push(`Invalid snapshot filename: ${name}`);
    continue;
  }
  const snapshot = await readJson(`data/snapshots/${name}`);
  if (Number.isNaN(Date.parse(snapshot.snapshot_at))) errors.push(`Invalid snapshot timestamp: ${name}`);
  else if (name !== `${shanghaiDate(snapshot.snapshot_at)}.json`) errors.push(`Snapshot filename and Asia/Shanghai date differ: ${name}`);
  const repos = snapshot.projects.map(project => project.repo.toLowerCase());
  for (const duplicate of duplicates(repos)) errors.push(`Duplicate repository in snapshot ${name}: ${duplicate}`);
  if (snapshot.projects.some(project => project.stars < 0 || project.forks < 0)) errors.push(`Negative metric in snapshot: ${name}`);
}

const [readme, html, app, tweet, dailyWorkflow, pagesWorkflow] = await Promise.all([
  fs.readFile(path.join(root, 'README.md'), 'utf8'),
  fs.readFile(path.join(root, 'docs/index.html'), 'utf8'),
  fs.readFile(path.join(root, 'docs/app.js'), 'utf8'),
  fs.readFile(path.join(root, 'tweet-draft.md'), 'utf8'),
  fs.readFile(path.join(root, '.github/workflows/daily-update.yml'), 'utf8'),
  fs.readFile(path.join(root, '.github/workflows/pages.yml'), 'utf8')
]);
if (!readme.includes(`已确认观察项目：**${active.length}**`)) errors.push('README summary is stale');
if (!readme.includes('<!-- RADAR_RANKING_START -->')) errors.push('README ranking marker missing');
if (!readme.includes('观察窗口趋势')) errors.push('README must use the honest observation-window label');
if (readme.includes('24h变化')) errors.push('README contains a hard-coded 24h change label');
if (!html.includes('Content-Security-Policy')) errors.push('Static page is missing a Content Security Policy');
if (!html.includes('aria-live="polite"')) errors.push('Static page is missing live ranking feedback');
if (!html.includes('id="ranking-table"') || !app.includes('colspan="8"')) errors.push('Static ranking table structure is incomplete');
if (!html.includes('class="skip-link"') || !html.includes('<main id="main" tabindex="-1">')) errors.push('Static page skip navigation is incomplete');
if (!tweet.includes('不代表全网穷尽')) errors.push('Tweet draft is missing the evidence boundary');
if (!dailyWorkflow.includes('timezone: "Asia/Shanghai"') || !dailyWorkflow.includes('contents: write')) errors.push('Daily workflow schedule or permissions are incomplete');
if (!pagesWorkflow.includes('workflow_run:') || !pagesWorkflow.includes('Daily ecosystem update')) errors.push('Pages workflow will not follow daily updates');
if (!pagesWorkflow.includes('pages: write') || !pagesWorkflow.includes('id-token: write')) errors.push('Pages workflow permissions are incomplete');

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(JSON.stringify({
  ok: true,
  projects: active.length,
  candidates: candidates.candidates.length,
  exclusions: exclusions.exclusions.length,
  snapshots: snapshotNames.length,
  ranked: rankings.current.length
}));
