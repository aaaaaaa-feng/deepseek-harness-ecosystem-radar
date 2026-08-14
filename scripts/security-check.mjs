import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ignored = new Set(['.git', 'node_modules', 'qa']);
const patterns = [
  /ghp_[A-Za-z0-9]{20,}/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /sk-[A-Za-z0-9_-]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/
];

async function filesUnder(directory) {
  const output = [];
  for (const entry of await fs.readdir(directory, {withFileTypes: true})) {
    if (ignored.has(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await filesUnder(target));
    else if (entry.isFile()) output.push(target);
  }
  return output;
}

const findings = [];
for (const file of await filesUnder(root)) {
  const stat = await fs.stat(file);
  if (stat.size > 5_000_000) continue;
  const content = await fs.readFile(file, 'utf8').catch(() => '');
  if (patterns.some(pattern => pattern.test(content))) {
    findings.push(path.relative(root, file));
  }
}

if (findings.length) {
  console.error(`Potential secret material found in: ${findings.join(', ')}`);
  process.exit(1);
}
console.log(JSON.stringify({ok: true, scanned_files: (await filesUnder(root)).length}));
