import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultConfig, simulateMesmer } from '#tests/helpers/mesmer-simulation.js';
import { applyBalanceProfilePatch, applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import { runMesmer } from '#tests/helpers/mesmer-simulation.js';
import { mesmerCatalog, mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerProfiledShatter } from '#gw2/professions/mesmer/core/profiles.js';
import { MESMER_VIRTUOSO_SHATTERS } from '#gw2/professions/mesmer/specializations/virtuoso/skills/index.js';

// Cancelled completions retain existing cooldowns instead of granting successful reset effects.
test('cancelled Ether preserves an established phantasm cooldown', () => {
  const rotation = ['Phantasmal Swordsman', { name: 'Signet of the Ether', interruptMs: 100 }];
  const result = simulateMesmer(rotation);
  const original = simulateMesmer(['Phantasmal Swordsman']);
  const ether = result.events.find((event) => event.type === 'action' && event.skillId === ID.SIGNET_OF_THE_ETHER);

  assert.equal(ether.cancelled, true);
  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.planningState.cooldowns['Phantasmal Swordsman']?.readyAt,
    original.planningState.cooldowns['Phantasmal Swordsman'].readyAt
  );
});

test('cancelled Mimic cannot reset the next utility cooldown', () => {
  const result = simulateMesmer([{ name: 'Mimic', interruptMs: 100 }, 'Signet of Illusions']);
  const mimic = result.events.find((event) => event.type === 'action' && event.skillId === ID.MIMIC);

  assert.equal(mimic.cancelled, true);
  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.planningState.cooldowns['Signet of Illusions']?.readyAt,
    simulateMesmer([{ type: 'wait', durationMs: mimic.endsAt * 1000 }, 'Signet of Illusions']).planningState.cooldowns[
      'Signet of Illusions'
    ].readyAt
  );
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
    assert.equal(cancelled.planningState.profession.notes.value, 3);
    assert.deepEqual(cancelled.planningState.profession.activeInstruments, []);
    assert.equal(completed.planningState.profession.notes.value, 0);
    assert.equal(completed.planningState.profession.activeInstruments[0].name, instrument);
    assert.ok(completed.planningState.profession.activeInstruments[0].remaining > 0);
  }
});

// The supported patch API must change executable blade ticks without mutating the base or zero-blade tier.
test('Virtuoso executes a patched shatter tick beside an empty zero-blade tier', () => {
  const profileId = MESMER_VIRTUOSO_SHATTERS[ID.BLADESONG_HARMONY].balanceProfileId;
  const original = mesmerCatalog.balanceProfilesById.get(profileId);
  const before = structuredClone(original);
  const patch = {
    balanceProfiles: {
      [profileId]: { effects: [{ effectIndex: 5, tickIndex: 0, coefficient: { from: 0.7, to: 7 } }] }
    }
  };
  const catalog = applyBalanceProfilePatch(mesmerCatalog, patch);
  const shatter = mesmerProfiledShatter({ catalog }, MESMER_VIRTUOSO_SHATTERS[ID.BLADESONG_HARMONY]);
  const profession = {
    runtimeFor(config) {
      const runtime = mesmerProfession.runtimeFor(config);
      return { ...runtime, catalog: applyBalanceProfilePatch(runtime.catalog, patch) };
    }
  };
  const result = runMesmer(['Bladesong Harmony', { name: '__wait', waitMs: 1000 }], createDefaultConfig(), {
    profession
  });
  const hit = result.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === ID.BLADESONG_HARMONY);

  assert.deepEqual(result.warnings, []);
  assert.equal(hit.coefficient, 7);
  assert.equal(shatter.strikes[5].ticks[0].coefficient, 7);
  assert.equal(shatter.strikes[0].coefficient, 0);
  assert.equal(shatter.strikes[0].ticks, undefined);
  assert.deepEqual(catalog.balanceProfilesById.get(profileId).effects[0], before.effects[0]);
  assert.deepEqual(original, before);
  assert.equal(MESMER_VIRTUOSO_SHATTERS[ID.BLADESONG_HARMONY].ticks[5][0].coefficient, 0.7);
});

// Removing a skill's declared CC removes the event even when a shatter or phantasm handler owns its other effects.
test('core control events are owned by skill definitions across ordinary and replacing handlers', () => {
  for (const skillId of [ID.MAGIC_BULLET, ID.DIVERSION, ID.PHANTASMAL_DEFENDER]) {
    const skill = mesmerCatalog.skillsById.get(skillId);
    const config = {
      ...createDefaultConfig(),
      specialization: 'Core',
      primaryWeapon: 'Scepter',
      secondaryWeapon: 'Pistol',
      initialResource: 0
    };
    const rotation = [skill.name, { type: 'wait', durationMs: 1000 }];
    const base = simulateMesmer(rotation, config);
    const profession = {
      runtimeFor(runtimeConfig) {
        const runtime = mesmerProfession.runtimeFor(runtimeConfig);
        return {
          ...runtime,
          catalog: applySkillPatch(runtime.catalog, {
            skills: { [skillId]: { removeEffects: [{ type: 'control' }] } }
          })
        };
      }
    };
    const removed = runMesmer(rotation, config, { profession });
    const controls = (result) => result.events.filter((event) => event.type === 'control' && event.skillId === skillId);
    assert.deepEqual(base.warnings, []);
    assert.deepEqual(removed.warnings, []);
    assert.equal(controls(base).length, 1, skill.name);
    assert.equal(controls(removed).length, 0, skill.name);
  }
});

// Skill-authored blinds keep their duration and emit once, including committed projectile cancellation.
test('core blinds are five-second skill effects without duplicate completion events', () => {
  for (const [rotation, primaryWeapon, secondaryWeapon, skillId] of [
    [['Chaos Armor'], 'Staff', '', ID.CHAOS_ARMOR],
    [['The Prestige'], 'Scepter', 'Torch', ID.THE_PRESTIGE],
    [['Signet of Midnight'], 'Scepter', 'Pistol', ID.SIGNET_OF_MIDNIGHT],
    [['Illusionary Counter', { name: 'Counterspell', interruptMs: 400 }], 'Scepter', 'Pistol', ID.COUNTERSPELL]
  ]) {
    const result = simulateMesmer(rotation, { specialization: 'Core', primaryWeapon, secondaryWeapon });
    assert.deepEqual(result.warnings, []);
    const blinds = result.events.filter((event) => event.type === 'blind' && event.skillId === skillId);
    assert.equal(blinds.length, 1);
    assert.equal(blinds[0].duration, 5);
  }
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
