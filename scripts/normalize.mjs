import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildArtifacts} from './build.mjs';
import {categoryFor} from './lib/radar.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function normalizeFile(relative, field) {
  const target = path.join(root, relative);
  const payload = JSON.parse(await fs.readFile(target, 'utf8'));
  let changed = 0;
  payload[field] = payload[field].map(project => {
    const category = categoryFor(project);
    if (category === project.category) return project;
    changed += 1;
    return {...project, category};
  });
  await fs.writeFile(target, `${JSON.stringify(payload, null, 2)}\n`);
  return changed;
}

const changed = (await Promise.all([
  normalizeFile('data/projects.json', 'projects'),
  normalizeFile('data/candidates.json', 'candidates')
])).reduce((total, count) => total + count, 0);

await buildArtifacts();
console.log(JSON.stringify({normalized_projects: changed}));
