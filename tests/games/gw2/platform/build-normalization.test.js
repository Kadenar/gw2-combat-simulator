import assert from 'node:assert/strict';
import test from 'node:test';

import { enumValue } from '#gw2/platform/builds/normalization.js';

test('enumValue accepts only exact allowed strings', () => {
  const allowed = ['one', 'two'];
  assert.equal(enumValue('two', allowed, 'one'), 'two');
  assert.equal(enumValue('Two', allowed, 'one'), 'one');
  assert.equal(enumValue(2, allowed, 'one'), 'one');
});

// Unusable input must reach the fallback: clamping NaN leaves NaN, which is what these guard against.
