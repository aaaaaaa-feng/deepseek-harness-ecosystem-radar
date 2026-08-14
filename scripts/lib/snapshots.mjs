import fs from 'node:fs/promises';
import path from 'node:path';

export const SHANGHAI_TIME_ZONE = 'Asia/Shanghai';

function asDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: ${String(value)}`);
  return date;
}

function shanghaiParts(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SHANGHAI_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(asDate(value));
  return Object.fromEntries(parts.map(part => [part.type, part.value]));
}

export function shanghaiDate(value = new Date()) {
  const parts = shanghaiParts(value);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function shanghaiHourKey(value = new Date()) {
  const parts = shanghaiParts(value);
  return `${parts.year}-${parts.month}-${parts.day}-${parts.hour}`;
}

export function snapshotFilename(kind, value = new Date()) {
  if (kind === 'hourly') return `${shanghaiHourKey(value)}.json`;
  if (kind === 'archive') return `${shanghaiDate(value)}.json`;
  throw new Error(`Unknown snapshot kind: ${kind}`);
}

export function describeSnapshotFile(directory, name) {
  const normalizedDirectory = directory.replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/$/, '');
  if (normalizedDirectory === 'data/snapshots') {
    const hourly = /^(\d{4}-\d{2}-\d{2}-\d{2})\.json$/.exec(name);
    if (hourly) return {kind: 'hourly', key: hourly[1]};
    const legacy = /^(\d{4}-\d{2}-\d{2})\.json$/.exec(name);
    if (legacy) return {kind: 'legacy-daily', key: legacy[1]};
  }
  if (normalizedDirectory === 'data/archive') {
    const archive = /^(\d{4}-\d{2}-\d{2})\.json$/.exec(name);
    if (archive) return {kind: 'archive', key: archive[1]};
  }
  return null;
}

async function readDirectory(root, relative) {
  try {
    return await fs.readdir(path.join(root, relative));
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

export async function loadSnapshotRecords(root) {
  const directories = ['data/snapshots', 'data/archive'];
  const records = [];
  for (const directory of directories) {
    const names = (await readDirectory(root, directory)).filter(name => name.endsWith('.json')).sort();
    for (const name of names) {
      const descriptor = describeSnapshotFile(directory, name);
      if (!descriptor) throw new Error(`Invalid snapshot path: ${directory}/${name}`);
      const relativePath = `${directory}/${name}`;
      const snapshot = JSON.parse(await fs.readFile(path.join(root, relativePath), 'utf8'));
      records.push({relativePath, descriptor, snapshot});
    }
  }
  return records;
}

export function dedupeSnapshotRecords(records) {
  const byTimestamp = new Map();
  const priority = {'hourly': 3, 'archive': 2, 'legacy-daily': 1};
  for (const record of records) {
    const timestamp = Date.parse(record?.snapshot?.snapshot_at);
    if (Number.isNaN(timestamp)) throw new Error(`Invalid snapshot timestamp: ${record?.relativePath || '(unknown path)'}`);
    const previous = byTimestamp.get(timestamp);
    if (previous) {
      if (JSON.stringify(previous.snapshot) !== JSON.stringify(record.snapshot)) {
        throw new Error(`Conflicting snapshots share timestamp ${record.snapshot.snapshot_at}`);
      }
      if ((priority[record.descriptor.kind] || 0) > (priority[previous.descriptor.kind] || 0)) {
        byTimestamp.set(timestamp, record);
      }
    } else {
      byTimestamp.set(timestamp, record);
    }
  }
  return [...byTimestamp.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, record]) => record);
}

export function hourlyPathsToPrune(records, latestAt, retentionDays) {
  if (!Number.isInteger(retentionDays) || retentionDays < 1) {
    throw new Error('retentionDays must be a positive integer');
  }
  const latestTimestamp = asDate(latestAt).getTime();
  const cutoff = latestTimestamp - retentionDays * 86_400_000;
  const archivedDates = new Set(
    records
      .filter(record => record.descriptor.kind === 'archive' || record.descriptor.kind === 'legacy-daily')
      .map(record => shanghaiDate(record.snapshot.snapshot_at)),
  );
  return records
    .filter(record => record.descriptor.kind === 'hourly')
    .filter(record => Date.parse(record.snapshot.snapshot_at) < cutoff)
    .filter(record => archivedDates.has(shanghaiDate(record.snapshot.snapshot_at)))
    .map(record => record.relativePath)
    .sort();
}

export async function pruneHourlySnapshots(root, records, latestAt, retentionDays) {
  const relativePaths = hourlyPathsToPrune(records, latestAt, retentionDays);
  await Promise.all(relativePaths.map(relativePath => fs.rm(path.join(root, relativePath))));
  return relativePaths;
}

export function snapshotRecordStats(records) {
  return {
    hourly: records.filter(record => record.descriptor.kind === 'hourly').length,
    archives: records.filter(record => record.descriptor.kind !== 'hourly').length,
    unique: dedupeSnapshotRecords(records).length
  };
}
