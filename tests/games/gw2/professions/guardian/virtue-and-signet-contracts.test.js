import { assertFlooredDamageMultiplier } from '#tests/helpers/rounded-damage.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createLiveProfessionSimulator } from '#tests/helpers/live-runtime.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from '#gw2/professions/guardian/data/ids.js';

const config = {
  stats: { power: 2000, precision: 1000, ferocity: 0, conditionDamage: 1000, vitality: 1000 },
  target: { armor: 2597 },
  primaryWeapon: 'Scepter'
};

test('Renewed Focus restores core activation traits and Flowing Resolve charges only on completion', () => {
  for (const interrupted of [false, true]) {
    const focus = interrupted
      ? { type: 'cast', skillId: GUARDIAN_SKILL_IDS.RENEWED_FOCUS, interruptAfterMs: 100 }
      : 'Renewed Focus';
    const core = createLiveProfessionSimulator(guardianProfession, {
      ...config,
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.INSPIRED_VIRTUE]
    })(undefined, ['Virtue of Justice', focus, ...(interrupted ? [] : ['Virtue of Justice'])]);
    assert.deepEqual(core.warnings, []);
    // A refreshed passive must enable the next activation's boon, without waiting for its old recharge.
    const activations = core.events.filter(
      (event) => event.type === 'action' && event.skillId === GUARDIAN_SKILL_IDS.JUSTICE
    );
    const boons = core.events.filter((event) => event.type === 'buff' && event.name === 'Inspired Virtue');
    assert.deepEqual(
      boons.map((event) => event.at),
      activations.map((event) => event.endsAt)
    );
    assert.equal(activations.length, interrupted ? 1 : 2);

    const willbender = createLiveProfessionSimulator(guardianProfession, { ...config, specialization: 'Willbender' })(
      undefined,
      ['Flowing Resolve', 'Flowing Resolve', focus]
    );
    assert.deepEqual(willbender.warnings, []);
    const ammo = willbender.planningState.ammo['Flowing Resolve'];
    assert.equal(ammo.charges, interrupted ? 0 : ammo.maximum);
    assert.equal(ammo.nextRechargeAt == null, !interrupted);
    assert.equal(Object.hasOwn(willbender.planningState.cooldowns, 'Flowing Resolve'), interrupted);
  }
});

test('Renewed Focus restores Firebrand pages and dormancy only on completion', () => {
  for (const interrupted of [false, true]) {
    const result = createLiveProfessionSimulator(guardianProfession, { ...config, specialization: 'Firebrand' })(
      undefined,
      [
        'Tome of Justice',
        'Chapter 1: Searing Spell',
        'Stow Tome',
        interrupted
          ? { type: 'cast', skillId: GUARDIAN_SKILL_IDS.RENEWED_FOCUS, interruptAfterMs: 100 }
          : 'Renewed Focus'
      ]
    );
    assert.deepEqual(result.warnings, []);
    const state = result.planningState.profession;
    const focus = result.events.find((event) => event.type === 'action' && event.skillName === 'Renewed Focus');
    assert.equal(state.tomePages.value, state.tomePages.maximum - Number(interrupted));
    // Refilling pages must preserve the regeneration phase established by the earlier spend.
    const spent = result.events.find(
      (event) => event.type === 'action' && event.skillId === GUARDIAN_SKILL_IDS.SEARING_SPELL
    );
    assert.equal(state.tomePages.nextAt, spent.endsAt + state.tomePages.interval);
    assert.equal(state.tomeDormantReadyAt.justice > focus.endsAt, interrupted);
    if (!interrupted) assert.deepEqual(state.tomeDormantReadyAt, state.virtueReadyAt);
  }
});

test('Bane Signet Power follows recharge and Perfect Inscriptions for raw and precomputed attributes', () => {
  for (const staticApplied of [false, true]) {
    for (const traited of [false, true]) {
      const bonus = 180 * (traited ? 1.2 : 1);
      const result = createLiveProfessionSimulator(guardianProfession, {
        ...config,
        stats: { ...config.stats, power: 2000 + (staticApplied ? bonus : 0) },
        attributeProvenance: { professionStaticRulesApplied: staticApplied },
        selectedSkills: ['Bane Signet'],
        selectedTraitIds: traited ? [GUARDIAN_TRAIT_IDS.PERFECT_INSCRIPTIONS] : []
      })(undefined, [
        'Orb of Wrath',
        'Bane Signet',
        'Orb of Wrath',
        { type: 'wait', durationMs: 40000 },
        'Orb of Wrath'
      ]);
      assert.deepEqual(result.warnings, []);
      const [before, during, after] = result.resolvedEvents.filter(
        (event) => event.type === 'damage' && event.skillName === 'Orb of Wrath'
      );
      // Identical attacks isolate the passive Power contribution from all other damage factors.
      assert.equal(before.damage, after.damage);
      assertFlooredDamageMultiplier(during.damage, before.damage, traited ? 1 : 2000 / (2000 + bonus));
    }
  }
});

test('Willbender misses cannot complete a virtue hit cycle', () => {
  for (const offTarget of [false, true]) {
    const result = createLiveProfessionSimulator(guardianProfession, { ...config, specialization: 'Willbender' })(
      undefined,
      [
        'Rushing Justice',
        ...Array.from({ length: 4 }, () => ({ type: 'cast', skillId: GUARDIAN_SKILL_IDS.ORB_OF_WRATH, offTarget })),
        { type: 'wait', durationMs: 1000 }
      ]
    );
    assert.deepEqual(result.warnings, []);
    assert.equal(result.combatState.profession.triggeredVirtueEffects > 0, !offTarget);
  }
});
