import assert from 'node:assert/strict';
import test from 'node:test';
import { runNative } from '../../helpers/elementalist-simulation.js';
import { elementalistCatalog } from '#gw2/professions/elementalist/catalog.js';
import { elementalistProfession } from '#gw2/professions/elementalist/definition.js';
import { createElementalistCoreState } from '#gw2/professions/elementalist/core/state.js';
import { applyElementalistResolverConjure } from '#gw2/professions/elementalist/core/mechanics/conjures.js';
import { modifyElementalistAttributes } from '#gw2/professions/elementalist/core/traits/modifiers.js';

const hammerOptions = {
  lines: [['Fire'], ['Air'], ['Arcane']],
  weapons: ['Sword', 'Dagger'],
  selectedSkills: { Utility1: 'Conjure Lightning Hammer' },
  assumptions: { quickness: false, alacrity: false }
};

test('Lightning Hammer keeps normal weapon skills visible but unavailable across specializations', () => {
  const normalSkill = elementalistCatalog.skillsByName.get('Flame Uprising');
  const hammerSkill = elementalistCatalog.skillsByName.get('Lightning Swing');
  // The family gate also applies before Weaver delegates its dual-attunement rules.
  for (const specialization of ['Core', 'Tempest', 'Weaver', 'Catalyst', 'Evoker']) {
    const context = {
      specialization,
      build: { selectedSkills: { Utility1: 'Conjure Lightning Hammer', Utility2: 'Conjure Frost Bow' } },
      professionState: { primaryAttunement: 'Fire', conjureEquipped: 'Lightning Hammer' }
    };
    const unavailable = elementalistProfession.ui.paletteSkillAvailability(context, normalSkill);
    assert.equal(unavailable.available, false, specialization);
    assert.match(unavailable.message, /Drop Lightning Hammer/);
    assert.equal(elementalistProfession.ui.paletteSkillAvailability(context, hammerSkill).available, true);
    assert.equal(
      elementalistProfession.ui.paletteSkillAvailability(context, elementalistCatalog.skillsByName.get('Frost Volley'))
        .available,
      false
    );
    const group = elementalistProfession.ui
      .paletteGroups(context)
      .find(({ id }) => id === 'elementalist-conjure-weapon-lightning-hammer');
    assert.equal(group.label, 'LH');
    context.professionState.conjureEquipped = null;
    assert.equal(elementalistProfession.ui.paletteSkillAvailability(context, normalSkill).available, true);
    assert.equal(elementalistProfession.ui.paletteSkillAvailability(context, hammerSkill).available, false);
    assert.equal(
      elementalistProfession.ui.paletteGroups(context).filter(({ id }) => id.startsWith('elementalist-conjure-weapon-'))
        .length,
      2
    );
  }
});

test('conjures expire their equipped and ground copies and restore the normal weapon bar', () => {
  // All conjures share the lifetime contract; waiting cannot preserve an equipped bundle indefinitely.
  for (const weapon of ['Lightning Hammer', 'Frost Bow', 'Fiery Greatsword']) {
    const conjure = `Conjure ${weapon}`;
    const result = runNative({
      ...hammerOptions,
      selectedSkills: { [weapon === 'Fiery Greatsword' ? 'Elite' : 'Utility1']: conjure },
      rotation: [conjure, 30000, 'Flame Uprising']
    });
    assert.deepEqual(result.warnings, [], weapon);
    assert.equal(result.endState.profession.conjureEquipped, null, weapon);
    assert.equal(result.endState.profession.conjureExpiresAt, 0, weapon);
    assert.deepEqual(result.endState.profession.conjurePickups, {}, weapon);
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
  assert.equal(leaps[1].start - leaps[0].end, 8000);
  assert.equal(result.endState.profession.conjureEquipped, 'Lightning Hammer');
  assert.deepEqual(result.endState.profession.conjurePickups, {});

  // The pickup starts while the ground copy exists and finishes after the original lifetime ends.
  const late = runNative({
    ...hammerOptions,
    rotation: ['Conjure Lightning Hammer', 29900, '__pickup_Lightning Hammer', 1000, 'Lightning Swing']
  });
  assert.deepEqual(late.warnings, []);
  const pickup = late.steps.find((step) => step.skill === '__pickup_Lightning Hammer');
  assert.equal(late.endState.profession.conjureExpiresAt, pickup.end / 1000 + 30);
  assert.equal(late.endState.profession.conjureEquipped, 'Lightning Hammer');

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
  assert.equal(casts[1].start - casts[0].end, 60000);
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
    assert.equal(result.endState.profession.conjureEquipped, elapsedMs < 30000 ? 'Lightning Hammer' : null);
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
  // Feed the same equip/drop events the scheduler publishes to the real resolver handler.
  applyElementalistResolverConjure(runtime, { conjureEquipped: 'Lightning Hammer', conjureExpiresAt: 31 });
  const held = modifyElementalistAttributes(context, attributes);
  assert.equal(held.precision - baseline.precision, 180);
  assert.equal(held.ferocity - baseline.ferocity, 75);
  assert.deepEqual(modifyElementalistAttributes({ ...context, time: 31 }, attributes), baseline);
  applyElementalistResolverConjure(runtime, { conjureEquipped: null, conjureExpiresAt: 0 });
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
