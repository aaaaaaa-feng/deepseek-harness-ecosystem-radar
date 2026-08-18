import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyProjectEnrichment,
  classifyDeveloperRegion,
  containsHan,
  normalizeDeveloperProfile,
  refreshDeveloperProfiles,
  updateTranslationCache
} from '../scripts/lib/enrichment.mjs';

test('developer location classification is conservative and deterministic', () => {
  assert.equal(classifyDeveloperRegion('Shanghai, China').region, 'mainland_china');
  assert.equal(classifyDeveloperRegion('Zhejiang Hangzhou').region, 'mainland_china');
  assert.equal(classifyDeveloperRegion('CN').region, 'mainland_china');
  assert.equal(classifyDeveloperRegion('Hong Kong').region, 'greater_china');
  assert.equal(classifyDeveloperRegion('Berlin, Germany').region, 'overseas');
  assert.equal(classifyDeveloperRegion('Earth').region, 'unknown');
  assert.equal(classifyDeveloperRegion('The Milky Way').region, 'unknown');
  assert.equal(classifyDeveloperRegion('').basis, 'location-not-public');
});

test('profile normalization keeps the public source and does not infer missing locations', () => {
  const profile = normalizeDeveloperProfile({
    login: 'example',
    type: 'Organization',
    html_url: 'https://github.com/example',
    location: null
  }, '2026-08-15T00:00:00.000Z');
  assert.equal(profile.account_type, 'Organization');
  assert.equal(profile.region, 'unknown');
  assert.equal(profile.location, '');
  assert.equal(profile.profile_url, 'https://github.com/example');
});

test('developer refresh deduplicates owners and reuses fresh cache entries', async () => {
  const calls = [];
  const result = await refreshDeveloperProfiles([
    {repo: 'NewOwner/one', owner: 'NewOwner'},
    {repo: 'NewOwner/two', owner: 'NewOwner'},
    {repo: 'Cached/three', owner: 'Cached'}
  ], {
    profiles: {
      cached: {
        login: 'Cached', region: 'overseas', region_label: '海外',
        location: 'Berlin, Germany',
        checked_at: '2026-08-14T12:00:00.000Z'
      }
    }
  }, {
    github: async pathname => {
      calls.push(pathname);
      return {login: 'NewOwner', type: 'User', html_url: 'https://github.com/NewOwner', location: '北京'};
    },
    observedAt: '2026-08-15T00:00:00.000Z',
    refreshDays: 30
  });
  assert.deepEqual(calls, ['/users/NewOwner']);
  assert.equal(result.payload.profiles.newowner.region, 'mainland_china');
  assert.equal(result.payload.profiles.cached.region, 'overseas');
  assert.equal(result.stats.cached, 1);
});

test('developer refresh limits stale profile requests and reports deferred owners', async () => {
  const calls = [];
  const result = await refreshDeveloperProfiles([
    {repo: 'c/one', owner: 'c'},
    {repo: 'a/one', owner: 'a'},
    {repo: 'b/one', owner: 'b'}
  ], {profiles: {}}, {
    github: async pathname => {
      calls.push(pathname);
      const login = pathname.split('/').at(-1);
      return {login, type: 'User', html_url: `https://github.com/${login}`, location: ''};
    },
    observedAt: '2026-08-18T13:00:00Z',
    refreshDays: 30,
    maxRefreshes: 2
  });
  assert.deepEqual(calls, ['/users/a', '/users/b']);
  assert.equal(result.stats.refreshed, 2);
  assert.equal(result.stats.deferred, 1);
});

test('project enrichment uses Chinese source, cached translation, and honest fallbacks', () => {
  const result = applyProjectEnrichment([
    {repo: 'a/zh', owner: 'a', description: '中文说明'},
    {repo: 'b/en', owner: 'b', description: 'Desktop client'},
    {repo: 'c/pending', owner: 'c', description: 'New plugin'}
  ], {
    profiles: {
      a: {login: 'a', region: 'mainland_china', region_label: '国内', location: '上海'}
    }
  }, {
    translations: {
      'b/en': {source_text: 'Desktop client', zh: '桌面客户端', provider: 'manual-baseline'}
    }
  });
  assert.equal(result[0].translation_status, 'source-zh');
  assert.equal(result[1].description_zh, '桌面客户端');
  assert.equal(result[1].translation_status, 'translated');
  assert.equal(result[2].translation_status, 'pending');
  assert.equal(result[2].developer.region, 'unknown');
});

test('translation cache only sends missing English descriptions and validates Chinese output', async () => {
  let requestBody;
  const result = await updateTranslationCache([
    {repo: 'a/zh', description: '已经是中文'},
    {repo: 'b/cached', description: 'Cached text'},
    {repo: 'c/new', description: 'New visual plugin'}
  ], {
    translations: {
      'b/cached': {source_text: 'Cached text', zh: '缓存译文', provider: 'manual-baseline'}
    }
  }, {
    token: 'test-token',
    model: 'openai/gpt-4.1-mini',
    observedAt: '2026-08-15T00:00:00.000Z',
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return new Response(JSON.stringify({
        choices: [{message: {content: JSON.stringify({translations: [{id: 'c/new', zh: '新的视觉插件'}]})}}]
      }), {status: 200});
    }
  });
  const input = JSON.parse(requestBody.messages[1].content);
  assert.deepEqual(input.items.map(item => item.id), ['c/new']);
  assert.equal(result.payload.translations['c/new'].zh, '新的视觉插件');
  assert.equal(result.stats.translated, 1);
  assert.ok(containsHan(result.payload.translations['c/new'].zh));
});

test('translation cache stays usable when no model token is available', async () => {
  const result = await updateTranslationCache(
    [{repo: 'a/new', description: 'A new plugin'}],
    {translations: {}},
    {token: ''}
  );
  assert.equal(result.stats.provider_available, false);
  assert.equal(result.stats.remaining, 1);
  assert.equal(result.stats.deferred, 1);
  assert.deepEqual(result.payload.translations, {});
});

test('translation cache bounds model work and reports deferred descriptions', async () => {
  const calls = [];
  const result = await updateTranslationCache([
    {repo: 'a/one', description: 'First plugin'},
    {repo: 'b/two', description: 'Second plugin'},
    {repo: 'c/three', description: 'Third plugin'}
  ], {translations: {}}, {
    token: 'test-token',
    maxItems: 2,
    batchSize: 2,
    fetchImpl: async (_url, options) => {
      const items = JSON.parse(JSON.parse(options.body).messages[1].content).items;
      calls.push(items.map(item => item.id));
      return new Response(JSON.stringify({
        choices: [{message: {content: JSON.stringify({
          translations: items.map(item => ({id: item.id, zh: `中文 ${item.id}`}))
        })}}]
      }), {status: 200});
    }
  });
  assert.deepEqual(calls, [['a/one', 'b/two']]);
  assert.equal(result.stats.attempted, 2);
  assert.equal(result.stats.translated, 2);
  assert.equal(result.stats.deferred, 1);
  assert.equal(result.stats.remaining, 1);
});
