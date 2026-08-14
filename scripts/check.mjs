import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateProjectSet} from './lib/radar.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async relative => JSON.parse(await fs.readFile(path.join(root, relative), 'utf8'));
const [config, projects, candidates, rankings, latest, docsLatest] = await Promise.all([
  readJson('config/radar.json'),
  readJson('data/projects.json'),
  readJson('data/candidates.json'),
  readJson('data/rankings.json'),
  readJson('data/latest.json'),
  readJson('docs/data/latest.json')
]);

const errors = validateProjectSet(projects.projects, config.release_cutoff_utc);
const active = projects.projects.filter(project => project.status === 'active' && project.evidence_level === 'confirmed');
if (rankings.current.length !== active.length) errors.push('Ranking count does not match active confirmed projects');
if (latest.summary.confirmed_projects !== active.length) errors.push('Latest summary count mismatch');
if (JSON.stringify(latest) !== JSON.stringify(docsLatest)) errors.push('docs/data/latest.json is not synchronized');
if (projects.projects.some(project => project.repo === 'unitarylab/quantum-practices')) errors.push('Known false positive is present');
if (!Array.isArray(candidates.candidates)) errors.push('Candidate payload is invalid');

for (const [index, item] of rankings.current.entries()) {
  if (item.rank !== index + 1) errors.push(`Non-contiguous ranking at ${item.repo}`);
  if (!Number.isFinite(item.attention_score)) errors.push(`Invalid score at ${item.repo}`);
}

const readme = await fs.readFile(path.join(root, 'README.md'), 'utf8');
if (!readme.includes(`已确认观察项目：**${active.length}**`)) errors.push('README summary is stale');
if (!readme.includes('<!-- RADAR_RANKING_START -->')) errors.push('README ranking marker missing');

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(JSON.stringify({ok: true, projects: active.length, candidates: candidates.candidates.length, ranked: rankings.current.length}));
