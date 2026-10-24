import assert from 'node:assert/strict';
import test from 'node:test';
import { ammoDisplayView } from '#ui/rotation/ammo-display.js';

test('ammo display exposes filled and spent charge pips', () => {
  assert.deepEqual(ammoDisplayView(1, 2), {
    current: 1,
    maximum: 2,
    pips: [true, false]
  });
});

test('ammo display clamps invalid counts and ignores non-ammo skills', () => {
  assert.deepEqual(ammoDisplayView(-1, 3), {
    current: 0,
    maximum: 3,
    pips: [false, false, false]
  });
  assert.equal(ammoDisplayView(1, 0), null);
});
