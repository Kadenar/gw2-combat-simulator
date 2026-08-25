import assert from 'node:assert/strict';
import test from 'node:test';

import { gw2BaseRecharge } from '../../../js/platform/gw2/skills/recharge.js';
import { gw2EffectiveCooldown } from '../../../js/platform/gw2/combat/query/runtime-rules.js';

test('GW2 base recharge selects positive ammo recharge before cooldown fields', () => {
  assert.equal(gw2BaseRecharge({ ammo: 2, ammoRecharge: 8, cooldown: 10, recharge: 12 }), 8);
  assert.equal(gw2BaseRecharge({ ammo: 2, ammoRecharge: 0, cooldown: 10, recharge: 12 }), 10);
  assert.equal(gw2BaseRecharge({ ammo: 0, ammoRecharge: 8, cooldown: 10, recharge: 12 }), 10);
});

test('GW2 base recharge prefers finite canonical cooldown and then legacy recharge', () => {
  assert.equal(gw2BaseRecharge({ cooldown: 10, recharge: 12 }), 10);
  assert.equal(gw2BaseRecharge({ cooldown: Number.NaN, recharge: 12 }), 12);
  assert.equal(gw2BaseRecharge({ cooldown: Number.POSITIVE_INFINITY, recharge: Number.NaN }), 0);
  assert.equal(gw2BaseRecharge({}), 0);
});

test('effective cooldown applies modifiers to the shared ammo-aware base recharge', () => {
  const skill = { id: 1, name: 'Ammo', ammo: 2, ammoRecharge: 8, cooldown: 10, recharge: 12 };
  assert.equal(gw2EffectiveCooldown(skill, {}, { cooldownMultiplier: 0.5, rechargeRate: 2 }), 2);
});
