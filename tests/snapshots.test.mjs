import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dedupeSnapshotRecords,
  describeSnapshotFile,
  hourlyPathsToPrune,
  shanghaiDate,
  shanghaiHourKey,
  snapshotFilename,
  snapshotRecordStats
} from '../scripts/lib/snapshots.mjs';

const snapshot = snapshotAt => ({schema_version: 1, snapshot_at: snapshotAt, source: 'test', projects: []});
const record = (relativePath, kind, key, snapshotAt) => ({
  relativePath,
  descriptor: {kind, key},
  snapshot: snapshot(snapshotAt)
});

test('Shanghai snapshot names preserve hourly and daily boundaries', () => {
  const timestamp = '2026-08-15T05:42:00.000Z';
  assert.equal(shanghaiDate(timestamp), '2026-08-15');
  assert.equal(shanghaiHourKey(timestamp), '2026-08-15-13');
  assert.equal(snapshotFilename('hourly', timestamp), '2026-08-15-13.json');
  assert.equal(snapshotFilename('archive', timestamp), '2026-08-15.json');
});

test('snapshot paths distinguish hourly detail, daily archive, and legacy daily files', () => {
  assert.deepEqual(describeSnapshotFile('data/snapshots', '2026-08-15-13.json'), {kind: 'hourly', key: '2026-08-15-13'});
  assert.deepEqual(describeSnapshotFile('data/archive', '2026-08-15.json'), {kind: 'archive', key: '2026-08-15'});
  assert.deepEqual(describeSnapshotFile('data/snapshots', '2026-08-14.json'), {kind: 'legacy-daily', key: '2026-08-14'});
  assert.equal(describeSnapshotFile('data/archive', 'latest.json'), null);
});

test('identical hourly and archive records are one observation point', () => {
  const timestamp = '2026-08-15T05:42:00.000Z';
  const records = [
    record('data/archive/2026-08-15.json', 'archive', '2026-08-15', timestamp),
    record('data/snapshots/2026-08-15-13.json', 'hourly', '2026-08-15-13', timestamp)
  ];
  const unique = dedupeSnapshotRecords(records);
  assert.equal(unique.length, 1);
  assert.equal(unique[0].descriptor.kind, 'hourly');
  assert.deepEqual(snapshotRecordStats(records), {hourly: 1, archives: 1, unique: 1});
});

test('conflicting snapshots cannot share a timestamp', () => {
  const timestamp = '2026-08-15T05:42:00.000Z';
  const left = record('data/archive/2026-08-15.json', 'archive', '2026-08-15', timestamp);
  const right = record('data/snapshots/2026-08-15-13.json', 'hourly', '2026-08-15-13', timestamp);
  right.snapshot.projects.push({repo: 'a/one', stars: 1, forks: 0});
  assert.throws(() => dedupeSnapshotRecords([left, right]), /Conflicting snapshots/);
});

test('hourly retention prunes only history protected by a daily archive', () => {
  const records = [
    record('data/archive/2026-08-01.json', 'archive', '2026-08-01', '2026-08-01T15:50:00.000Z'),
    record('data/snapshots/2026-08-01-23.json', 'hourly', '2026-08-01-23', '2026-08-01T15:50:00.000Z'),
    record('data/snapshots/2026-08-02-23.json', 'hourly', '2026-08-02-23', '2026-08-02T15:50:00.000Z'),
    record('data/snapshots/2026-08-15-13.json', 'hourly', '2026-08-15-13', '2026-08-15T05:50:00.000Z')
  ];
  assert.deepEqual(hourlyPathsToPrune(records, '2026-08-15T05:50:00.000Z', 7), [
    'data/snapshots/2026-08-01-23.json'
  ]);
});
