import test from 'node:test';
import assert from 'node:assert/strict';
import {createGitHubClient, mapLimit} from '../scripts/lib/github.mjs';

test('GitHub client retries transient errors and returns parsed JSON', async () => {
  let calls = 0;
  const delays = [];
  const client = createGitHubClient({
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) return new Response('temporarily unavailable', {status: 503});
      return new Response(JSON.stringify({ok: true}), {status: 200});
    },
    sleepImpl: async delay => delays.push(delay),
    maxAttempts: 3
  });
  assert.deepEqual(await client('/repos/example/project'), {ok: true});
  assert.equal(calls, 2);
  assert.deepEqual(delays, [1000]);
});

test('GitHub client treats an allowed 404 as an unavailable repository', async () => {
  const client = createGitHubClient({
    fetchImpl: async () => new Response('not found', {status: 404})
  });
  assert.equal(await client('/repos/example/missing', {allow404: true}), null);
});

test('GitHub client does not retry ordinary authorization failures', async () => {
  let calls = 0;
  const client = createGitHubClient({
    fetchImpl: async () => {
      calls += 1;
      return new Response('forbidden', {status: 403});
    },
    sleepImpl: async () => assert.fail('ordinary 403 should not sleep')
  });
  await assert.rejects(client('/repos/example/private'), /GitHub API 403/);
  assert.equal(calls, 1);
});

test('mapLimit preserves output order', async () => {
  const output = await mapLimit([3, 1, 2], 2, async value => value * 10);
  assert.deepEqual(output, [30, 10, 20]);
});
