import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attentionScore,
  buildRankings,
  categoryFor,
  reconcileCatalogs,
  relevanceEvidence,
  validateProjectSet,
  validateRadarConfig
} from '../scripts/lib/radar.mjs';

test('exact DeepSeek Harness implementation is confirmed', () => {
  const result = relevanceEvidence({
    full_name: 'example/deepseek-harness-desktop',
    description: 'Desktop client for DeepSeek Harness',
    language: 'TypeScript',
    topics: []
  });
  assert.equal(result.level, 'confirmed');
});

test('ambiguous DSH repository is not auto-confirmed', () => {
  const result = relevanceEvidence({
    full_name: 'unitarylab/quantum-practices',
    description: 'Quantum Algorithms Best Practices',
    language: 'Python',
    topics: []
  }, 'Generic research repository');
  assert.equal(result.level, 'excluded');
});

test('generic README mention is held for review, while a direct implementation is confirmed', () => {
  const generic = relevanceEvidence({
    full_name: 'example/agent-benchmark',
    description: 'Agent benchmark suite',
    language: 'Python',
    topics: []
  }, 'We compare several tools, including DeepSeek Harness, in this benchmark.');
  const direct = relevanceEvidence({
    full_name: 'example/new-plugin',
    description: 'Developer utility',
    language: 'TypeScript',
    topics: []
  }, 'This plugin is built for DeepSeek Harness and adds a project status panel.');
  assert.equal(generic.level, 'candidate');
  assert.equal(direct.level, 'confirmed');
});

test('category classifier recognizes a model gateway', () => {
  assert.equal(categoryFor('DeepSeek Harness model router gateway plugin'), '渠道与模型接入');
});

test('category classifier prioritizes concrete plugin and UI signals', () => {
  assert.equal(categoryFor('DeepSeek Harness visual plugin marketplace'), '插件管理与生态工具');
  assert.equal(categoryFor({repo: 'dancingmemory/dskin', description: 'pixel skin for DSH Web UI'}), '界面与体验扩展');
  assert.equal(categoryFor('DSH Web UI minigames while waiting for model replies'), '界面与体验扩展');
  assert.equal(categoryFor('Template for deepseek-harness plugin development'), '插件管理与生态工具');
  assert.equal(categoryFor({repo: 'example/dsh-balance', description: 'balance and cost readout for the Web GUI'}), '记忆、上下文与成本');
  assert.equal(categoryFor('Robotic Harness research tools with simulation diagnostics'), '开发与质量工具');
});

test('attention score grows with observable popularity', () => {
  assert.ok(attentionScore({stars: 100, forks: 10}) > attentionScore({stars: 10, forks: 1}));
});

test('rankings calculate snapshot deltas and rank changes', () => {
  const projects = [
    {repo: 'a/one', url: 'https://github.com/a/one', category: 'A', first_seen_at: '2026-08-14T00:00:00Z'},
    {repo: 'b/two', url: 'https://github.com/b/two', category: 'B', first_seen_at: '2026-08-14T00:00:00Z'}
  ];
  const rankings = buildRankings(projects, [
    {snapshot_at: '2026-08-14T00:00:00Z', projects: [{repo: 'a/one', stars: 10, forks: 1}, {repo: 'b/two', stars: 20, forks: 1}]},
    {snapshot_at: '2026-08-15T00:00:00Z', projects: [{repo: 'a/one', stars: 30, forks: 2}, {repo: 'b/two', stars: 21, forks: 1}]}
  ]);
  assert.equal(rankings.current[0].repo, 'a/one');
  assert.equal(rankings.current[0].stars_delta, 20);
  assert.equal(rankings.current[0].rank_change, 1);
  assert.equal(rankings.observation_window_hours, 24);
});

test('rankings reject invalid or duplicate snapshot timestamps', () => {
  assert.throws(() => buildRankings([], [{snapshot_at: 'invalid', projects: []}]), /Invalid snapshot timestamp/);
  assert.throws(() => buildRankings([], [
    {snapshot_at: '2026-08-14T00:00:00Z', projects: []},
    {snapshot_at: '2026-08-14T00:00:00Z', projects: []}
  ]), /unique and increasing/);
});

test('project validation catches duplicates and cutoff violations', () => {
  const projects = [
    {repo: 'a/one', url: 'https://github.com/a/one', created_at: '2026-08-13T13:00:00Z'},
    {repo: 'a/one', url: 'https://github.com/a/one', created_at: '2026-08-14T13:00:00Z'}
  ];
  const errors = validateProjectSet(projects, '2026-08-13T13:02:03.901Z');
  assert.ok(errors.some(error => error.startsWith('Before cutoff')));
  assert.ok(errors.some(error => error.startsWith('Duplicate repo')));
});

test('catalog reconciliation makes denylist and evidence transitions mutually exclusive', () => {
  const result = reconcileCatalogs({
    projects: [{repo: 'A/Confirmed', stars: 10}],
    candidates: [{repo: 'B/Maybe', first_seen_at: '2026-08-14T00:00:00Z'}],
    exclusions: [{repo: 'C/Old', discovered_at: '2026-08-14T00:00:00Z'}],
    evaluated: [
      {project: {repo: 'B/Maybe', url: 'https://github.com/B/Maybe', evidence_level: 'excluded', evidence_reason: '证据不足'}},
      {project: {repo: 'C/Old', url: 'https://github.com/C/Old', evidence_level: 'candidate', stars: 2}}
    ],
    denylist: ['A/Confirmed'],
    observedAt: '2026-08-15T00:00:00Z'
  });
  assert.deepEqual(result.projects, []);
  assert.deepEqual(result.candidates.map(item => item.repo), ['C/Old']);
  assert.deepEqual(result.exclusions.map(item => item.repo), ['A/Confirmed', 'B/Maybe']);
  assert.match(result.exclusions[0].reason, /denylist/);
});

test('catalog promotion preserves original discovery time and query provenance', () => {
  const result = reconcileCatalogs({
    candidates: [{
      repo: 'Example/Plugin',
      first_seen_at: '2026-08-14T00:00:00Z',
      discovery_queries: ['first-query']
    }],
    evaluated: [{
      project: {
        repo: 'example/plugin',
        url: 'https://github.com/example/plugin',
        evidence_level: 'confirmed',
        first_seen_at: '2026-08-15T00:00:00Z'
      },
      discovery_queries: ['second-query']
    }],
    observedAt: '2026-08-15T00:00:00Z'
  });
  assert.equal(result.projects[0].first_seen_at, '2026-08-14T00:00:00Z');
  assert.deepEqual(result.projects[0].discovery_queries, ['first-query', 'second-query']);
  assert.deepEqual(result.candidates, []);
});

test('radar configuration validation rejects unsafe update bounds', () => {
  const errors = validateRadarConfig({
    release_cutoff_utc: 'not-a-date',
    discovery_lookback_days: 0,
    search_pages_per_query: 11,
    max_readmes_per_run: 0,
    api_max_attempts: 9,
    api_max_retry_delay_ms: 30_001,
    public_repository_url: 'https://example.com/repo',
    queries: ['missing placeholder']
  });
  assert.ok(errors.length >= 8);
});
