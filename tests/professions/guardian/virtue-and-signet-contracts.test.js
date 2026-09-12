import assert from 'node:assert/strict';
import test from 'node:test';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { guardianProfession } from '#gw2/professions/guardian/definition.js';
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
    const core = simulateGw2({
      profession: guardianProfession,
      rotation: ['Virtue of Justice', focus, ...(interrupted ? [] : ['Virtue of Justice'])],
      config: { ...config, selectedTraitIds: [GUARDIAN_TRAIT_IDS.INSPIRED_VIRTUE] }
    });
    assert.deepEqual(core.warnings, []);
    // A refreshed passive must enable the next activation's boon, without waiting for its old recharge.
    const activations = core.events.filter((event) => event.type === 'guardian.virtue-activated');
    const boons = core.events.filter((event) => event.type === 'buff' && event.name === 'Inspired Virtue');
    assert.deepEqual(
      boons.map((event) => event.at),
      activations.map((event) => event.at)
    );
    assert.equal(
      core.events.some((event) => event.type === 'guardian.virtues-refreshed'),
      !interrupted
    );

    const willbender = simulateGw2({
      profession: guardianProfession,
      rotation: ['Flowing Resolve', 'Flowing Resolve', focus],
      config: { ...config, specialization: 'Willbender' }
    });
    assert.deepEqual(willbender.warnings, []);
    const ammo = willbender.endState.ammo['Flowing Resolve'];
    assert.equal(ammo.charges, interrupted ? 0 : ammo.maximum);
    assert.equal(ammo.nextRechargeAt == null, !interrupted);
    assert.equal(Object.hasOwn(willbender.endState.cooldowns, 'Flowing Resolve'), interrupted);
  }
});

test('Renewed Focus restores Firebrand pages and dormancy only on completion', () => {
  for (const interrupted of [false, true]) {
    const result = simulateGw2({
      profession: guardianProfession,
      rotation: [
        'Tome of Justice',
        'Chapter 1: Searing Spell',
        'Stow Tome',
        interrupted
          ? { type: 'cast', skillId: GUARDIAN_SKILL_IDS.RENEWED_FOCUS, interruptAfterMs: 100 }
          : 'Renewed Focus'
      ],
      config: { ...config, specialization: 'Firebrand' }
    });
    assert.deepEqual(result.warnings, []);
    const state = result.endState.profession;
    const focus = result.events.find((event) => event.type === 'action' && event.skillName === 'Renewed Focus');
    assert.equal(state.tomePages, state.maximumTomePages - Number(interrupted));
    assert.equal(state.nextTomePageAt === Number.POSITIVE_INFINITY, !interrupted);
    assert.equal(state.tomeDormantReadyAt.justice > focus.endsAt, interrupted);
    if (!interrupted) assert.deepEqual(state.tomeDormantReadyAt, state.virtueReadyAt);
  }
});

test('Bane Signet Power follows recharge and Perfect Inscriptions for raw and precomputed attributes', () => {
  for (const staticApplied of [false, true]) {
    for (const traited of [false, true]) {
      const bonus = 180 * (traited ? 1.2 : 1);
      const result = simulateGw2({
        profession: guardianProfession,
        rotation: ['Orb of Wrath', 'Bane Signet', 'Orb of Wrath', { type: 'wait', durationMs: 40000 }, 'Orb of Wrath'],
        config: {
          ...config,
          stats: { ...config.stats, power: 2000 + (staticApplied ? bonus : 0) },
          attributeProvenance: { professionStaticRulesApplied: staticApplied },
          selectedSkills: ['Bane Signet'],
          selectedTraitIds: traited ? [GUARDIAN_TRAIT_IDS.PERFECT_INSCRIPTIONS] : []
        }
      });
      assert.deepEqual(result.warnings, []);
      const [before, during, after] = result.resolvedEvents.filter(
        (event) => event.type === 'damage' && event.skillName === 'Orb of Wrath'
      );
      // Identical attacks isolate the passive Power contribution from all other damage factors.
      assert.equal(before.damage, after.damage);
      assert.ok(Math.abs(during.damage / before.damage - (traited ? 1 : 2000 / (2000 + bonus))) < 1e-9);
    }
  }
});

test('Willbender misses cannot complete a virtue hit cycle', () => {
  for (const offTarget of [false, true]) {
    const result = simulateGw2({
      profession: guardianProfession,
      rotation: [
        'Rushing Justice',
        ...Array.from({ length: 4 }, () => ({ type: 'cast', skillId: GUARDIAN_SKILL_IDS.ORB_OF_WRATH, offTarget })),
        { type: 'wait', durationMs: 1000 }
      ],
      config: { ...config, specialization: 'Willbender' }
    });
    assert.deepEqual(result.warnings, []);
    assert.equal(
      result.events.some((event) => event.type === 'guardian.willbender-virtue-triggered'),
      !offTarget
    );
  }
});
