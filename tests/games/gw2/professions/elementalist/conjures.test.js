import { planningFixture } from '#tests/helpers/observed-runtime.js';
import { elementalistCatalog } from '#gw2/professions/elementalist/catalog.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { runNative } from '#tests/helpers/elementalist-simulation.js';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { createElementalistCoreState } from '#gw2/professions/elementalist/core/state.js';
import { modifyElementalistAttributes } from '#gw2/professions/elementalist/core/modifiers.js';

const hammerOptions = {
  lines: [['Fire'], ['Air'], ['Arcane']],
  weapons: ['Sword', 'Dagger'],
  selectedSkillIds: { Utility1: 5624 },
  assumptions: { quickness: false, alacrity: false }
};

test('Lightning Hammer keeps normal weapon skills visible but unavailable across specializations', () => {
  for (const specialization of ['Core', 'Tempest', 'Weaver', 'Catalyst', 'Evoker']) {
    for (const conjureEquipped of [null, 'Lightning Hammer']) {
      const state = planningFixture(
        elementalistProfession,
        { specialization, startAttunement: 'Fire', secondaryAttunement: 'Fire' },
        (runtime) => {
          runtime.profession.core.conjureEquipped = conjureEquipped;
        }
      );
      assert.equal(
        state.availability[elementalistCatalog.skillsByName.get('Flame Uprising').id].ready,
        !conjureEquipped
      );
      assert.equal(
        state.availability[elementalistCatalog.skillsByName.get('Lightning Swing').id].ready,
        Boolean(conjureEquipped)
      );
      assert.equal(state.availability[elementalistCatalog.skillsByName.get('Frost Volley').id].ready, false);
      const groups = elementalistProfession.ui.paletteGroups({
        catalog: elementalistCatalog,
        specialization,
        professionState: state.profession,
        build: { selectedSkillIds: { Utility1: 5624, Utility2: 5567 } }
      });
      assert.equal(groups.filter(({ id }) => id.startsWith('elementalist-conjure-weapon-')).length, 2);
    }
  }
});

test('conjures expire their equipped and ground copies and restore the normal weapon bar', () => {
  // All conjures share the lifetime contract; waiting cannot preserve an equipped bundle indefinitely.
  for (const weapon of ['Lightning Hammer', 'Frost Bow', 'Fiery Greatsword']) {
    const conjure = `Conjure ${weapon}`;
    const result = runNative({
      ...hammerOptions,
      selectedSkillIds: {
        [weapon === 'Fiery Greatsword' ? 'Elite' : 'Utility1']: elementalistCatalog.skillsByName.get(conjure).id
      },
      rotation: [conjure, 30000, 'Flame Uprising']
    });
    assert.deepEqual(result.warnings, [], weapon);
    assert.equal(result.planningState.profession.conjureEquipped, null, weapon);
    assert.equal(result.planningState.profession.conjureExpiresAt, 0, weapon);
    assert.deepEqual(result.planningState.profession.conjurePickups, {}, weapon);
  }
});

test('a late ground pickup grants a fresh lifetime, is consumed once, and keeps skill cooldowns', () => {
  const result = runNative({
    ...hammerOptions,
    rotation: [
      'Conjure Lightning Hammer',
      'Lightning Leap',
      '__drop_bundle',
      '__pickup_Lightning Hammer',
      'Lightning Leap'
    ]
  });
  assert.deepEqual(result.warnings, []);
  const leaps = result.steps.filter((step) => step.skill === 'Lightning Leap');
  assert.equal(leaps[1].start - leaps[0].end, 6400);
  assert.equal(result.planningState.profession.conjureEquipped, 'Lightning Hammer');
  assert.deepEqual(result.planningState.profession.conjurePickups, {});

  // The pickup starts while the ground copy exists and finishes after the original lifetime ends.
  const late = runNative({
    ...hammerOptions,
    rotation: ['Conjure Lightning Hammer', 29900, '__pickup_Lightning Hammer', 1000, 'Lightning Swing']
  });
  assert.deepEqual(late.warnings, []);
  const pickup = late.steps.find((step) => step.skill === '__pickup_Lightning Hammer');
  assert.equal(late.planningState.profession.conjureExpiresAt, pickup.end / 1000 + 30);
  assert.equal(late.planningState.profession.conjureEquipped, 'Lightning Hammer');

  const expired = runNative({
    ...hammerOptions,
    rotation: ['Conjure Lightning Hammer', 30000, '__pickup_Lightning Hammer', 'Lightning Swing']
  });
  assert.ok(expired.warnings.some((warning) => /pickup is unavailable or expired/.test(warning)));
  assert.ok(expired.warnings.some((warning) => /requires the Lightning Hammer bundle/.test(warning)));
});

test('Conjure Lightning Hammer keeps its sixty-second recharge across bundle expiry', () => {
  const result = runNative({
    ...hammerOptions,
    rotation: ['Conjure Lightning Hammer', 30000, 'Conjure Lightning Hammer']
  });
  assert.deepEqual(result.warnings, []);
  const casts = result.steps.filter((step) => step.skill === 'Conjure Lightning Hammer');
  assert.equal(casts[1].start - casts[0].end, 48000);
});

test('picking up the second conjure after twenty-nine seconds starts a fresh thirty-second window', () => {
  // The ground copy supplies a new player duration instead of inheriting the original hammer's remaining second.
  for (const elapsedMs of [29900, 30000]) {
    const result = runNative({
      ...hammerOptions,
      rotation: ['Conjure Lightning Hammer', 29000, '__pickup_Lightning Hammer', elapsedMs]
    });
    assert.deepEqual(result.warnings, []);
    const pickup = result.steps.find((step) => step.skill === '__pickup_Lightning Hammer');
    const grant = result.events.find(
      (event) => event.type === 'elementalist.conjure' && event.skillName === '__pickup_Lightning Hammer'
    );
    assert.equal(grant.conjureExpiresAt, pickup.end / 1000 + 30);
    assert.equal(result.planningState.profession.conjureEquipped, elapsedMs < 30000 ? 'Lightning Hammer' : null);
  }
});

test('Lightning Hammer advances its autoattack chain and resets it when dropped', () => {
  const result = runNative({
    ...hammerOptions,
    rotation: [
      'Conjure Lightning Hammer',
      'Lightning Swing',
      'Static Swing',
      'Thunderclap',
      'Lightning Swing',
      '__drop_bundle',
      '__pickup_Lightning Hammer',
      'Lightning Swing'
    ]
  });
  assert.deepEqual(result.warnings, []);
  const blind = result.events.find((event) => event.type === 'blind' && event.skillName === 'Thunderclap');
  assert.equal(blind.duration, 3);
  const denied = runNative({ ...hammerOptions, rotation: ['Conjure Lightning Hammer', 'Static Swing'] });
  assert.ok(denied.warnings.some((warning) => /Lightning Swing/.test(warning)));
});

test('Lightning Hammer attributes follow the wielder through utility hits, drop, and expiry', () => {
  const core = createElementalistCoreState();
  const runtime = { profession: { core } };
  const attributes = { precision: 1000, ferocity: 0 };
  const context = { runtime, config: { selectedTraitIds: [] }, event: { skillName: 'Arcane Wave' }, time: 1 };
  const baseline = modifyElementalistAttributes(context, attributes);
  // Attribute queries read the live equipped bundle and its expiry.
  Object.assign(core, { conjureEquipped: 'Lightning Hammer', conjureExpiresAt: 31 });
  const held = modifyElementalistAttributes({ catalog: elementalistCatalog, ...context }, attributes);
  assert.equal(held.precision - baseline.precision, 180);
  assert.equal(held.ferocity - baseline.ferocity, 75);
  assert.deepEqual(modifyElementalistAttributes({ ...context, time: 31 }, attributes), baseline);
  Object.assign(core, { conjureEquipped: null, conjureExpiresAt: 0 });
  assert.deepEqual(modifyElementalistAttributes(context, attributes), baseline);
});

test('Invoke Lightning uses linear per-hit falloff with the requested hitbox midpoint', () => {
  const skill = elementalistCatalog.skillsByName.get('Invoke Lightning');
  const ticks = skill.effects[0].ticks;
  ticks.forEach((tick, index) => {
    assert.ok(Math.abs(tick.coefficient - Math.max(0.24, 0.825 * (1 - index * 0.1))) < 1e-9);
  });
  // A minimal cast verifies the formula after the runtime's hitbox filtering.
  for (const [hitboxSize, totalCoefficient] of [
    ['small', 5.97],
    ['large', 7.17]
  ]) {
    const result = runNative({
      ...hammerOptions,
      assumptions: { ...hammerOptions.assumptions, hitboxSize },
      rotation: ['Conjure Lightning Hammer', 'Invoke Lightning', 2000]
    });
    assert.deepEqual(result.warnings, []);
    const coefficient = result.events
      .filter((event) => event.type === 'damage' && event.skillName === 'Invoke Lightning')
      .reduce((sum, event) => sum + event.coefficient, 0);
    assert.ok(Math.abs(coefficient - totalCoefficient) < 1e-9, hitboxSize);
  }
});
