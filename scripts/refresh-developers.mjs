import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildArtifacts} from './build.mjs';
import {refreshDeveloperProfiles} from './lib/enrichment.mjs';
import {createGitHubClient} from './lib/github.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async relative => JSON.parse(await fs.readFile(path.join(root, relative), 'utf8'));
const writeJsonAtomic = async (relative, value) => {
  const target = path.join(root, relative);
  const temporary = path.join(path.dirname(target), `.tmp-${path.basename(target)}-${process.pid}`);
  try {
    await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
    await fs.rename(temporary, target);
  } finally {
    await fs.rm(temporary, {force: true});
  }
};

const [config, projectsPayload, candidatesPayload, developerPayload] = await Promise.all([
  readJson('config/radar.json'),
  readJson('data/projects.json'),
  readJson('data/candidates.json'),
  readJson('data/developers.json')
]);
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const github = createGitHubClient({
  token,
  maxAttempts: config.api_max_attempts,
  maxRetryDelayMs: config.api_max_retry_delay_ms
});
const observedAt = new Date().toISOString();
const result = await refreshDeveloperProfiles(
  [...projectsPayload.projects, ...candidatesPayload.candidates],
  developerPayload,
  {github, observedAt, refreshDays: 0}
);
await writeJsonAtomic('data/developers.json', result.payload);
await buildArtifacts();
console.log(JSON.stringify(result.stats));
