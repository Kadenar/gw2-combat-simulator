import assert from 'node:assert/strict';
import test from 'node:test';
import { conditionTickDamage } from '#gw2/platform/combat/damage/condition-formulas.js';

test('condition damage uses the canonical combat-domain formulas', () => {
  // One row per formula branch keeps coefficients, aliases, and edge behavior explicit.
  const cases = [
    ['Bleeding', 1000, undefined, 82],
    ['Burning', 1000, undefined, 286],
    ['Confusion', 1000, undefined, 68.25],
    ['Fear', 1000, undefined, 844],
    ['Poison', 1000, undefined, 93.5],
    ['Poisoned', 1000, undefined, 93.5],
    ['Torment', 1000, undefined, 121.8],
    ['Torment', 1000, { stationary: false }, 82],
    ['Unknown', 1000, undefined, 0],
    ['Bleeding', -1000, undefined, 22]
  ];

  for (const [condition, conditionDamage, options, expected] of cases) {
    assert.equal(conditionTickDamage(condition, conditionDamage, options), expected, condition);
  }
});
