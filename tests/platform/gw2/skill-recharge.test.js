import assert from 'node:assert/strict';
import test from 'node:test';
import { gw2BaseRecharge } from '#gw2/platform/skills/recharge.js';
import { gw2EffectiveCooldown } from '#gw2/platform/combat/query/runtime-rules.js';
import { createCanonicalCatalog } from '#gw2/platform/engine/skills/catalog.js';
import { defineProfession } from '#gw2/platform/engine/profession/contract.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';

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

test('declarative ammo consumes and recharges shared charges', () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930001,
        name: 'Fixture Ammo',
        type: 'Utility',
        castTimeMs: 0,
        cooldown: 0.25,
        recharge: 0.25,
        ammo: 2,
        ammoRecharge: 5,
        effects: [{ type: 'strike', coefficient: 1 }]
      }
    ]
  });
  const profession = defineProfession({
    id: 'ammo-fixture',
    name: 'Ammo Fixture',
    catalog
  });
  const result = simulateGw2({
    profession,
    rotation: ['Fixture Ammo', 'Fixture Ammo', { type: 'wait', durationMs: 5000 }]
  });

  assert.equal(result.resolvedEvents.filter((event) => event.type === 'damage').length, 2);
  assert.deepEqual(
    result.events.filter((event) => event.type === 'action').map((event) => event.at),
    [0, 0.25]
  );
  assert.deepEqual(result.endState.ammo['Fixture Ammo'], {
    charges: 1,
    maximum: 2,
    rechargeDuration: 5,
    nextRechargeAt: 10
  });
});

test("shared scheduler waits until a skill's exact cooldown expiry", () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930002,
        name: 'Fixture Cooldown',
        type: 'Utility',
        castTimeMs: 0,
        cooldown: 0.3,
        effects: [{ type: 'strike', coefficient: 1 }]
      }
    ]
  });
  const profession = defineProfession({
    id: 'cooldown-fixture',
    name: 'Cooldown Fixture',
    catalog
  });
  const result = simulateGw2({
    profession,
    rotation: ['Fixture Cooldown', 'Fixture Cooldown']
  });
  const actions = result.events.filter((event) => event.type === 'action');

  assert.deepEqual(
    actions.map((event) => event.at),
    [0, 0.3]
  );
  assert.deepEqual(
    result.steps.map((step) => step.start),
    [0, 300]
  );
  assert.equal(result.endState.time, 300);
  assert.equal(result.endState.cooldowns['Fixture Cooldown'].readyAt, 600);
  assert.deepEqual(result.warnings, []);
});
