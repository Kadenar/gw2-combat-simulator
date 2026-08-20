import assert from 'node:assert/strict';
import test from 'node:test';

import { boundedInteger, boundedNumber, enumValue } from '../../../js/platform/gw2/build-normalization.js';

test('boundedNumber coerces scalars, preserves zero, and clamps to inclusive bounds', () => {
  assert.equal(boundedNumber('4.5', 2, 0, 5), 4.5);
  assert.equal(boundedNumber(0, 2, 0, 5), 0);
  assert.equal(boundedNumber('invalid', 2, 0, 5), 2);
  assert.equal(boundedNumber(Number.POSITIVE_INFINITY, 2, 0, 5), 5);
  assert.equal(boundedNumber(-1, 2, 0, 5), 0);
});

test('boundedInteger truncates before clamping and applies its fallback', () => {
  assert.equal(boundedInteger('4.9', 2, 0, 5), 4);
  assert.equal(boundedInteger('invalid', 2, 0, 5), 2);
  assert.equal(boundedInteger(Number.NEGATIVE_INFINITY, 2, 0, 5), 0);
});

test('enumValue accepts only exact allowed strings', () => {
  const allowed = ['one', 'two'];
  assert.equal(enumValue('two', allowed, 'one'), 'two');
  assert.equal(enumValue('Two', allowed, 'one'), 'one');
  assert.equal(enumValue(2, allowed, 'one'), 'one');
});
