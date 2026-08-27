import assert from 'node:assert/strict';
import test from 'node:test';
import { conditionTickDamage } from '../../../js/games/gw2/platform/combat/damage/condition-formulas.js';

test('condition damage uses the canonical combat-domain formula', () => {
  assert.equal(conditionTickDamage('Torment', 1000, { stationary: false }), 82);
});
