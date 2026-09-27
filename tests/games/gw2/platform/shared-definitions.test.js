import assert from 'node:assert/strict';
import test from 'node:test';
import { resourceAtLeast, RESOURCE_TOLERANCE } from '#gw2/platform/combat/resources/pool.js';
import { isFlatLifeStealPacket } from '#gw2/platform/resolver/packets.js';
import { createDodgeSkill, createWeaponSwapSkill, SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';

// Small rounding drift must not block affordability, while a real resource deficit still does.
test('resource thresholds preserve their dedicated precision', () => {
  assert.equal(resourceAtLeast(100 - RESOURCE_TOLERANCE / 2, 100), true);
  assert.equal(resourceAtLeast(100 - RESOURCE_TOLERANCE * 2, 100), false);
  assert.equal(resourceAtLeast(0, 0), true);
});

// Explicit finite zero counts as flat life steal; unrelated strikes and nonfinite payloads do not.
test('flat life steal requires both identity and a finite strike field', () => {
  for (const field of ['flatDamage', 'flatStrikeBase', 'flatStrikePowerCoeff']) {
    assert.equal(isFlatLifeStealPacket({ damageKind: 'life-steal', [field]: 0 }), true);
    assert.equal(isFlatLifeStealPacket({ damageKind: 'strike', [field]: 5 }), false);
    assert.equal(isFlatLifeStealPacket({ damageKind: 'life-steal', [field]: Infinity }), false);
  }

  assert.equal(isFlatLifeStealPacket({ damageKind: 'life-steal' }), false);
});

// Shared identity preserves local action policies and gives each declaration its own packet array.
test('shared actions retain profession-owned cooldowns and resource commitments', () => {
  assert.equal(createWeaponSwapSkill().id, SHARED_SKILL_IDS.SWAP_WEAPONS);
  assert.equal(createWeaponSwapSkill().cooldown, 10);
  assert.equal(createWeaponSwapSkill({ cooldown: 5 }).cooldown, 5);
  const stow = createWeaponSwapSkill({ cooldown: 0, inputCategory: 'bar-swap' });
  assert.equal(stow.cooldown, 0);
  assert.equal(stow.inputCategory, 'bar-swap');
  const cost = { resource: 'endurance', amount: 50, spendOn: 'castCommit' };
  const dodge = createDodgeSkill({ cost });
  assert.equal(dodge.id, SHARED_SKILL_IDS.DODGE);
  assert.deepEqual(dodge.cost, cost);
  assert.notEqual(dodge.effects, createDodgeSkill().effects);
});
