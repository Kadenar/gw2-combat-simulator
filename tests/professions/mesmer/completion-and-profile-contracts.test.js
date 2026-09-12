import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultConfig, simulateMesmer } from '../../helpers/mesmer-simulation.js';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { mesmerProfession } from '#gw2/professions/mesmer/definition.js';
import { mesmerCatalog } from '#gw2/professions/mesmer/catalog.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerProfiledShatters } from '#gw2/professions/mesmer/core/profiles.js';
import { MESMER_VIRTUOSO_SHATTERS } from '#gw2/professions/mesmer/specializations/virtuoso/mechanics/definitions.js';
import { VIRTUOSO_SHATTER_PROFILE_IDS } from '#gw2/professions/mesmer/specializations/virtuoso/profiles.js';

// Cancelled completions retain existing cooldowns instead of granting successful reset effects.
test('cancelled Ether preserves an established phantasm cooldown', () => {
  const rotation = ['Phantasmal Swordsman', { name: 'Signet of the Ether', interruptMs: 100 }];
  const result = simulateMesmer(rotation);
  const original = simulateMesmer(['Phantasmal Swordsman']);
  const ether = result.events.find((event) => event.type === 'action' && event.skillId === ID.SIGNET_OF_THE_ETHER);

  assert.equal(ether.cancelled, true);
  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.endState.cooldowns['Phantasmal Swordsman']?.readyAt,
    original.endState.cooldowns['Phantasmal Swordsman'].readyAt
  );
});

test('cancelled Mimic cannot reset the next utility cooldown', () => {
  const result = simulateMesmer([{ name: 'Mimic', interruptMs: 100 }, 'Signet of Illusions']);
  const mimic = result.events.find((event) => event.type === 'action' && event.skillId === ID.MIMIC);
  const utility = result.events.find((event) => event.type === 'action' && event.skillId === ID.SIGNET_OF_ILLUSIONS);

  assert.equal(mimic.cancelled, true);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.cooldowns['Signet of Illusions']?.readyAt, utility.rechargeReadyAt * 1000);
  assert.equal(
    result.events.some((event) => event.type === 'proc' && event.source === 'Mimic'),
    false
  );
});

// A cancelled performance preserves notes and instrument state; a successful one commits both.
test('instrument commitment requires a performance that was not cancelled', () => {
  for (const [name, instrument] of [
    ['Lively Lute', 'Lute'],
    ['Flustering Flute', 'Flute']
  ]) {
    const config = { specialization: 'Troubadour', initialResource: 3 };
    const cancelled = simulateMesmer([{ name, interruptMs: 100 }], config);
    const completed = simulateMesmer([name], config);

    assert.equal(cancelled.events.find((event) => event.type === 'action').cancelled, true);
    assert.deepEqual(cancelled.warnings, []);
    assert.equal(cancelled.endState.profession.resource, 3);
    assert.deepEqual(cancelled.endState.profession.activeInstruments, []);
    assert.equal(completed.endState.profession.resource, 0);
    assert.equal(completed.endState.profession.activeInstruments[0].name, instrument);
    assert.ok(completed.endState.profession.activeInstruments[0].remaining > 0);
  }
});

// The supported patch API must change executable blade ticks without mutating the base or zero-blade tier.
test('Virtuoso executes a patched shatter tick beside an empty zero-blade tier', () => {
  const profileId = VIRTUOSO_SHATTER_PROFILE_IDS[ID.BLADESONG_HARMONY];
  const original = mesmerCatalog.balanceProfilesById.get(profileId);
  const before = structuredClone(original);
  const patch = {
    balanceProfiles: {
      [profileId]: { effects: [{ effectIndex: 5, tickIndex: 0, coefficient: { from: 0.7, to: 7 } }] }
    }
  };
  const catalog = applyBalanceProfilePatch(mesmerCatalog, patch);
  const shatter = mesmerProfiledShatters({ catalog }, MESMER_VIRTUOSO_SHATTERS, VIRTUOSO_SHATTER_PROFILE_IDS)[
    ID.BLADESONG_HARMONY
  ];
  const profession = {
    resolveRuntime(config) {
      const runtime = mesmerProfession.resolveRuntime(config);
      return { ...runtime, catalog: applyBalanceProfilePatch(runtime.catalog, patch) };
    }
  };
  const result = simulateGw2({
    profession,
    config: createDefaultConfig(),
    rotation: ['Bladesong Harmony', { name: '__wait', waitMs: 1000 }]
  });
  const hit = result.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === ID.BLADESONG_HARMONY);

  assert.deepEqual(result.warnings, []);
  assert.equal(hit.coefficient, 7);
  assert.equal(shatter.ticks[5][0].coefficient, 7);
  assert.equal(shatter.coefficients[0], 0);
  assert.deepEqual(shatter.ticks[0], []);
  assert.deepEqual(catalog.balanceProfilesById.get(profileId).effects[0], before.effects[0]);
  assert.deepEqual(original, before);
  assert.equal(MESMER_VIRTUOSO_SHATTERS[ID.BLADESONG_HARMONY].ticks[5][0].coefficient, 0.7);
});

// The personal Fury application must leave all four allied slots available to the separate allied effect.
test('one Master Fencer proc grants personal Fury and reaches four other players', () => {
  const result = simulateMesmer(['Flying Cutter'], {
    selectedTraitIds: [TRAIT.MASTER_FENCER],
    stats: { precision: 3100 },
    boons: { fury: false },
    allies: { count: 4, strikesPerSecond: 0 }
  });
  const fury = result.events.filter((event) => event.type === 'buff' && event.skillId === TRAIT.MASTER_FENCER);
  const personal = fury.filter((event) => event.resolvedAudience.includesSelf);
  const allied = fury.find((event) => event.audience.recipients === 'party');

  assert.deepEqual(result.warnings, []);
  assert.equal(personal.length, 1);
  assert.equal(personal[0].duration, 8);
  assert.equal(personal[0].resolvedAudience.recipientCount, 1);
  assert.equal(allied.duration, 4);
  assert.equal(allied.resolvedAudience.includesSelf, false);
  assert.equal(allied.resolvedAudience.alliedPlayerCount, 4);
  assert.equal(allied.resolvedAudience.recipientCount, 4);
});
