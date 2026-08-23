import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {applyProjectEnrichment, containsHan, DEVELOPER_REGION_LABELS} from './lib/enrichment.mjs';
import {plannedGitHubRequestCeiling, validateProjectSet, validateRadarConfig} from './lib/radar.mjs';
import {
  archivePathsToPrune,
  dedupeSnapshotRecords,
  hourlyPathsToPrune,
  loadSnapshotRecords,
  shanghaiDate,
  shanghaiHourKey,
  snapshotRecordStats
} from './lib/snapshots.mjs';

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

const [config, projects, candidates, exclusions, developers, translations, rankings, categoryPayload, latest, docsLatest, allowlist, denylist] = await Promise.all([
  readJson('config/radar.json'),
  readJson('data/projects.json'),
  readJson('data/candidates.json'),
  readJson('data/exclusions.json'),
  readJson('data/developers.json'),
  readJson('data/translations.json'),
  readJson('data/rankings.json'),
  readJson('data/categories.json'),
  readJson('data/latest.json'),
  readJson('docs/data/latest.json'),
  readJson('config/manual-allowlist.json'),
  readJson('config/manual-denylist.json')
]);

const errors = [
  ...validateRadarConfig(config),
  ...validateProjectSet(projects.projects, config.release_cutoff_utc),
  ...validateProjectSet(candidates.candidates, config.release_cutoff_utc)
    .map(error => `Candidate ${error}`)
];
const active = projects.projects.filter(project => project.status === 'active' && project.evidence_level === 'confirmed');
const enrichedActive = applyProjectEnrichment(active, developers, translations);
const projectKeys = keySet(projects.projects);
const candidateKeys = keySet(candidates.candidates);
const exclusionKeys = keySet(exclusions.exclusions);
const denied = new Set(denylist.repositories.map(repo => repo.toLowerCase()));
const repositoryPattern = /^[^/\s]+\/[^/\s]+$/;
const plannedRequestCeiling = plannedGitHubRequestCeiling(config, allowlist.repositories.length);
if (plannedRequestCeiling > config.api_request_budget_per_run) errors.push('Planned GitHub API work exceeds the configured per-run budget');

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
if (latest.rankings.current.length !== active.length) errors.push('Public ranking count mismatch');
if (Object.hasOwn(latest, 'projects') || Object.hasOwn(latest, 'signals')) errors.push('Public latest payload contains duplicated full project data');
if (latest.rankings.momentum.length > config.public_momentum_limit) errors.push('Public momentum payload exceeds configured limit');
if (JSON.stringify(latest.rankings.momentum) !== JSON.stringify(rankings.momentum.slice(0, config.public_momentum_limit))) errors.push('Public momentum payload is not the ranked prefix');
if (JSON.stringify(latest) !== JSON.stringify(docsLatest)) errors.push('docs/data/latest.json is not synchronized');
if (categoryPayload.generated_at !== rankings.generated_at) errors.push('Category rankings timestamp mismatch');
if (JSON.stringify(categoryPayload.categories) !== JSON.stringify(rankings.category_rankings)) errors.push('Category rankings artifact mismatch');
if (projects.projects.some(project => project.repo === 'unitarylab/quantum-practices')) errors.push('Known false positive is present');
if (!developers?.profiles || typeof developers.profiles !== 'object' || Array.isArray(developers.profiles)) errors.push('Developer profiles cache is invalid');
if (!translations?.translations || typeof translations.translations !== 'object' || Array.isArray(translations.translations)) errors.push('Translation cache is invalid');

const validRegions = new Set(Object.keys(DEVELOPER_REGION_LABELS));
for (const project of enrichedActive) {
  if (!validRegions.has(project.developer?.region)) errors.push(`Invalid developer region at ${project.repo}`);
  if (project.developer?.region_label !== DEVELOPER_REGION_LABELS[project.developer?.region]) errors.push(`Developer region label mismatch at ${project.repo}`);
  if (!project.developer?.profile_url?.startsWith('https://github.com/')) errors.push(`Invalid developer profile URL at ${project.repo}`);
  if (!['empty', 'source-zh', 'translated', 'pending'].includes(project.translation_status)) errors.push(`Invalid translation status at ${project.repo}`);
  if (project.translation_status === 'translated' && !containsHan(project.description_zh)) errors.push(`Translated description is not Chinese at ${project.repo}`);
}
const developerAccounts = new Map(enrichedActive.map(project => [project.developer.login.toLowerCase(), project.developer]));
const expectedRegions = Object.fromEntries([...validRegions].map(region => [region, 0]));
for (const developer of developerAccounts.values()) expectedRegions[developer.region] += 1;
if (latest.summary.developer_accounts !== developerAccounts.size) errors.push('Developer account count mismatch');
if (JSON.stringify(latest.summary.developer_regions) !== JSON.stringify(expectedRegions)) errors.push('Developer region summary mismatch');
if (latest.summary.pending_translations !== enrichedActive.filter(project => project.translation_status === 'pending').length) errors.push('Pending translation count mismatch');

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

const categoryNames = new Set(active.map(project => project.category || '其他实现型扩展'));
if (rankings.category_rankings.length !== categoryNames.size) errors.push('Category ranking count mismatch');
for (const key of ['rank_by_stars', 'rank_by_projects']) {
  const values = rankings.category_rankings.map(item => item[key]).sort((a, b) => a - b);
  if (values.some((value, index) => value !== index + 1)) errors.push(`Category ${key} is not contiguous`);
}
if (rankings.previous_snapshot_at) {
  const comparableCategories = rankings.category_rankings.filter(item => item.stars_delta != null);
  const momentumRanks = comparableCategories.map(item => item.rank_by_momentum).sort((a, b) => a - b);
  if (momentumRanks.some((value, index) => value !== index + 1)) errors.push('Category momentum ranks are not contiguous');
  if (rankings.category_rankings.some(item => (item.stars_delta == null) !== (item.rank_by_momentum == null))) errors.push('Category momentum rank and delta coverage differ');
} else if (rankings.category_rankings.some(item => item.rank_by_momentum != null || item.stars_delta != null)) {
  errors.push('Category momentum exists without a comparable snapshot');
}
if (rankings.category_rankings.reduce((sum, item) => sum + item.project_count, 0) !== active.length) errors.push('Category project totals mismatch');
if (rankings.category_rankings.reduce((sum, item) => sum + item.total_stars, 0) !== active.reduce((sum, item) => sum + Number(item.stars || 0), 0)) errors.push('Category star totals mismatch');

const snapshotRecords = await loadSnapshotRecords(root);
const uniqueSnapshotRecords = dedupeSnapshotRecords(snapshotRecords);
const snapshotStats = snapshotRecordStats(snapshotRecords);
if (uniqueSnapshotRecords.length !== latest.summary.snapshots) errors.push('Unique snapshot point count mismatch');
if (snapshotStats.hourly !== latest.summary.hourly_snapshots) errors.push('Hourly snapshot count mismatch');
if (snapshotStats.archives !== latest.summary.daily_archives) errors.push('Daily archive count mismatch');
for (const record of snapshotRecords) {
  const {relativePath, descriptor, snapshot} = record;
  const expectedKey = descriptor.kind === 'hourly'
    ? shanghaiHourKey(snapshot.snapshot_at)
    : shanghaiDate(snapshot.snapshot_at);
  if (descriptor.key !== expectedKey) errors.push(`Snapshot filename and Asia/Shanghai time differ: ${relativePath}`);
  const repos = snapshot.projects.map(project => project.repo.toLowerCase());
  for (const duplicate of duplicates(repos)) errors.push(`Duplicate repository in snapshot ${relativePath}: ${duplicate}`);
  if (snapshot.projects.some(project => project.stars < 0 || project.forks < 0)) errors.push(`Negative metric in snapshot: ${relativePath}`);
}
const latestSnapshotAt = uniqueSnapshotRecords.at(-1)?.snapshot.snapshot_at;
if (latestSnapshotAt) {
  const staleHourlyPaths = hourlyPathsToPrune(snapshotRecords, latestSnapshotAt, config.hourly_snapshot_retention_days);
  for (const relativePath of staleHourlyPaths) errors.push(`Prunable hourly snapshot remains: ${relativePath}`);
  const staleArchivePaths = archivePathsToPrune(snapshotRecords, latestSnapshotAt, config.daily_archive_retention_days);
  for (const relativePath of staleArchivePaths) errors.push(`Prunable daily archive remains: ${relativePath}`);
}

const [readme, html, app, styles, tweet, categoryCsv, hourlyWorkflow, pagesWorkflow, publicLatestStat] = await Promise.all([
  fs.readFile(path.join(root, 'README.md'), 'utf8'),
  fs.readFile(path.join(root, 'docs/index.html'), 'utf8'),
  fs.readFile(path.join(root, 'docs/app.js'), 'utf8'),
  fs.readFile(path.join(root, 'docs/styles.css'), 'utf8'),
  fs.readFile(path.join(root, 'tweet-draft.md'), 'utf8'),
  fs.readFile(path.join(root, 'data/categories.csv'), 'utf8'),
  fs.readFile(path.join(root, '.github/workflows/hourly-update.yml'), 'utf8'),
  fs.readFile(path.join(root, '.github/workflows/pages.yml'), 'utf8'),
  fs.stat(path.join(root, 'docs/data/latest.json'))
]);
if (!readme.includes('为一个正在形成中的开源生态')) errors.push('README is missing the project purpose');
if (!readme.includes('不是实时流式数据')) errors.push('README must explain the hourly snapshot boundary');
if (!readme.includes('<!-- RADAR_TOP10_START -->') || !readme.includes('<!-- RADAR_TOP10_END -->')) errors.push('README daily Top 10 markers are missing');
if (!readme.includes('README 每天最多更新一次')) errors.push('README must explain the daily repository checkpoint');
if (readme.includes('<!-- RADAR_SUMMARY_') || readme.includes('<!-- RADAR_RANKING_') || readme.includes('<!-- RADAR_CATEGORY_')) errors.push('README still contains oversized generated snapshot sections');
if (readme.includes('已确认观察项目：**')) errors.push('README still embeds volatile snapshot counts');
if (config.public_site_url && !readme.includes(config.public_site_url)) errors.push('README is missing the public site URL');
if (!html.includes('Content-Security-Policy')) errors.push('Static page is missing a Content Security Policy');
if (!html.includes("script-src 'self' https://static.cloudflareinsights.com/beacon.min.js")) errors.push('Static page CSP must allow the Cloudflare Web Analytics beacon');
if (!html.includes("connect-src 'self' https://cloudflareinsights.com")) errors.push('Static page CSP must allow Cloudflare Web Analytics data uploads');
if (!html.includes("img-src 'self' data: https://github.com https://avatars.githubusercontent.com")) errors.push('Static page CSP must allow validated GitHub avatar images');
if (!html.includes('<meta name="referrer" content="same-origin">')) errors.push('Static page must preserve same-origin referrers for Cloudflare Web Analytics');
if (!html.includes('aria-live="polite"')) errors.push('Static page is missing live ranking feedback');
if (!html.includes('id="ranking-table"') || !html.includes('id="region"') || !app.includes('colspan="9"')) errors.push('Static ranking table structure is incomplete');
if (!html.includes('id="ranking-viewport"') || !html.includes('id="ranking-range"') || !html.includes('id="ranking-scroll-next"') || !html.includes('avatar-orbit-1') || !app.includes('updateRankingViewport') || !app.includes('PageDown') || !styles.includes('.ranking-viewport thead th { position: sticky;')) errors.push('Scrollable ranking viewport is incomplete');
if (!app.includes('data-label="排名"') || !app.includes('data-label="分类排名"') || !styles.includes('@media (max-width: 640px)') || !styles.includes('#ranking-table tbody {') || !styles.includes('.category-table tbody {')) errors.push('Mobile card layouts are incomplete');
if (!html.includes('id="ecosystem-top20"') || !html.includes('id="planet-leaders"') || !html.includes('id="planet-detail"') || !app.includes('githubAvatarUrl') || !app.includes('renderPlanetDetail') || !app.includes('slice(0, 20)') || !styles.includes('.orb-rank-20') || !styles.includes('--orb-size-mobile')) errors.push('Top 20 GitHub avatar orbit is incomplete');
if (!html.includes('id="category-ranking"') || !html.includes('data-category-sort="stars"') || !app.includes('renderCategoryRanking')) errors.push('Static category leaderboard is incomplete');
if (!categoryCsv.startsWith('rank_by_stars,rank_by_projects,rank_by_momentum,category,')) errors.push('Category CSV header is incomplete');
if (categoryCsv.trim().split('\n').length !== rankings.category_rankings.length + 1) errors.push('Category CSV row count mismatch');
if (!html.includes('class="skip-link"') || !html.includes('<main id="main" tabindex="-1">')) errors.push('Static page skip navigation is incomplete');
if (!tweet.includes('不代表全网穷尽')) errors.push('Tweet draft is missing the evidence boundary');
if (config.public_site_url && !tweet.includes(config.public_site_url)) errors.push('Tweet draft is missing the public site URL');
if (publicLatestStat.size > 20 * 1024 * 1024) errors.push('Public latest payload exceeds the 20 MiB deployment guard');
if (!hourlyWorkflow.includes('cron: "17 * * * *"') || !hourlyWorkflow.includes('timezone: "Asia/Shanghai"') || !hourlyWorkflow.includes('contents: write') || !hourlyWorkflow.includes('models: read')) errors.push('Hourly workflow schedule or permissions are incomplete');
if (!hourlyWorkflow.includes('actions/cache/restore@v5') || !hourlyWorkflow.includes('actions/cache/save@v5')) errors.push('Hourly workflow does not persist rolling state outside Git history');
if (!hourlyWorkflow.includes('radar-live') || !hourlyWorkflow.includes('HEAD:refs/heads/${LIVE_BRANCH}')) errors.push('Hourly workflow does not publish the generated live branch');
if (!hourlyWorkflow.includes('GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}') || !hourlyWorkflow.includes('x-access-token:${GITHUB_TOKEN}')) errors.push('Hourly workflow does not authenticate the isolated live-branch push explicitly');
if (hourlyWorkflow.includes('git config --local --get http.https://github.com/.extraheader')) errors.push('Hourly workflow still assumes checkout credentials live in local Git config');
if (!hourlyWorkflow.includes('git add -- README.md STATUS.md tweet-draft.md data docs/data/latest.json')) errors.push('Hourly workflow does not create the bounded daily checkpoint');
if (hourlyWorkflow.includes('Commit hourly snapshot')) errors.push('Hourly workflow still commits every run to main');
if (pagesWorkflow.includes('workflow_run:')) errors.push('GitHub Pages workflow still follows every hourly run');
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
  snapshots: uniqueSnapshotRecords.length,
  hourly_snapshots: snapshotStats.hourly,
  daily_archives: snapshotStats.archives,
  ranked: rankings.current.length
}));
