import assert from 'node:assert/strict';
import test from 'node:test';
import {buildArtifacts} from '../scripts/build.mjs';

test('artifact builder remains importable', () => {
  assert.equal(typeof buildArtifacts, 'function');
});
