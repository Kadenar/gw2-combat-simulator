import assert from 'node:assert/strict';
import test from 'node:test';

import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { engineerProfession } from '#gw2/professions/engineer/definition.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { engineerCoreCriticalHitDefinitions } from '#gw2/professions/engineer/core/traits/index.js';
import { engineerCoreSchedulerHooks } from '#gw2/professions/engineer/core/traits/modifiers.js';

const baseConfig = Object.freeze({
  selectedSkills: ['Healing Turret', 'Grenade Kit', 'Throw Mine', 'Elixir Gun', 'Supply Crate'],
  stats: {
    power: 2000,
    precision: 1500,
    ferocity: 500,
    conditionDamage: 1000,
    expertise: 0,
    vitality: 1000
  },
  target: { armor: 2597, conditions: {} }
});

// Run the smallest Core rotation that reaches a migrated trait through the public dispatcher.
function simulate(rotation, config = {}) {
  return simulateGw2({
    profession: engineerProfession,
    rotation,
    config: {
      ...baseConfig,
      ...config,
      specialization: 'Core',
      stats: { ...baseConfig.stats, ...(config.stats || {}) },
      target: { ...baseConfig.target, ...(config.target || {}) }
    }
  });
}

const wait = { type: 'wait', durationMs: 100 };

const traitCases = [
  {
    name: 'Grenadier',
    trait: TRAIT.GRENADIER,
    rotation: ['Healing Turret'],
    verify: (result) =>
      assert.equal(
        result.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Lesser Grenade Barrage')
          .length,
        6
      )
  },
  {
    name: 'Explosive Entrance and its dodge reset',
    trait: TRAIT.EXPLOSIVE_ENTRANCE,
    rotation: ['Grenade Kit', 'Grenade', 'Dodge', 'Grenade', wait],
    verify: (result) =>
      assert.equal(
        result.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Explosive Entrance').length,
        2
      )
  },
  {
    name: 'Steel-Packed Powder',
    trait: TRAIT.STEEL_PACKED_POWDER,
    rotation: ['Grenade Kit', 'Grenade', wait],
    verify: (result) =>
      assert.ok(
        result.resolvedEvents.some(
          (event) =>
            event.type === 'condition' &&
            event.sourceId === TRAIT.STEEL_PACKED_POWDER &&
            event.condition === 'Vulnerability'
        )
      )
  },
  {
    name: 'Short Fuse',
    trait: TRAIT.SHORT_FUSE,
    rotation: ['Grenade Kit', 'Grenade', wait],
    verify: (result) => assert.ok(result.procSteps.some((step) => step.skill === 'Short Fuse'))
  },
  {
    name: 'Explosive Temper',
    trait: TRAIT.EXPLOSIVE_TEMPER,
    rotation: ['Grenade Kit', 'Grenade', wait],
    verify: (result) => assert.ok(result.procSteps.some((step) => step.skill === 'Explosive Temper'))
  },
  {
    name: 'Grand Entrance',
    trait: TRAIT.GRAND_ENTRANCE,
    extraTraits: [TRAIT.EXPLOSIVE_ENTRANCE],
    rotation: ['Puncturing Jab', wait],
    verify: (result) => assert.ok(result.procSteps.some((step) => step.skill === 'Grand Entrance'))
  },
  {
    name: 'Shrapnel',
    trait: TRAIT.SHRAPNEL,
    rotation: ['Grenade Kit', 'Grenade', 'Shrapnel Grenade', wait],
    verify: (result) =>
      assert.ok(
        result.resolvedEvents.some(
          (event) => event.type === 'condition' && event.sourceId === TRAIT.SHRAPNEL && event.condition === 'Bleeding'
        )
      )
  },
  {
    name: 'Aim-Assisted Rocket',
    trait: TRAIT.AIM_ASSISTED_ROCKET,
    rotation: ['Grenade Kit', 'Grenade', wait],
    verify: (result) =>
      assert.ok(result.resolvedEvents.some((event) => event.type === 'damage' && event.name === 'Aim-Assisted Rocket'))
  },
  {
    name: 'Serrated Steel',
    trait: TRAIT.SERRATED_STEEL,
    rotation: ['Grenade Kit', 'Grenade', 'Grenade', wait],
    config: { stats: { precision: 4000 } },
    verify: (result) =>
      assert.ok(
        result.resolvedEvents.some(
          (event) =>
            event.type === 'condition' && event.sourceId === TRAIT.SERRATED_STEEL && event.condition === 'Bleeding'
        )
      )
  },
  {
    name: 'No Scope',
    trait: TRAIT.NO_SCOPE,
    rotation: ['Puncturing Jab', wait],
    config: { stats: { precision: 4000 } },
    verify: (result) => assert.ok(result.procSteps.some((step) => step.skill === 'No Scope'))
  },
  {
    name: 'Incendiary Powder',
    trait: TRAIT.INCENDIARY_POWDER,
    rotation: ['Puncturing Jab', wait],
    config: { stats: { precision: 4000 } },
    verify: (result) =>
      assert.ok(
        result.resolvedEvents.some(
          (event) =>
            event.type === 'condition' && event.sourceId === TRAIT.INCENDIARY_POWDER && event.condition === 'Burning'
        )
      )
  },
  {
    name: 'Thermal Vision',
    trait: TRAIT.THERMAL_VISION,
    rotation: ['Blowtorch', wait],
    verify: (result) => assert.ok(result.profession.traitProcReadyAt.thermalVisionUntil > 0)
  },
  {
    name: 'Sanguine Array',
    trait: TRAIT.SANGUINE_ARRAY,
    rotation: ['Fragmentation Shot', wait],
    verify: (result) => assert.ok(result.procSteps.some((step) => step.skill === 'Sanguine Array'))
  },
  {
    name: 'Hematic Focus',
    trait: TRAIT.HEMATIC_FOCUS,
    rotation: ['Fragmentation Shot', wait],
    verify: (result) => assert.ok(result.procSteps.some((step) => step.skill === 'Hematic Focus'))
  },
  {
    name: 'HGH',
    trait: TRAIT.HGH,
    rotation: ['Elixir Gun', 'Acid Bomb', { type: 'wait', durationMs: 6500 }],
    config: { selectedSkills: [...baseConfig.selectedSkills, 'Elixir Gun'] },
    verify: (result) => {
      const field = result.events.find((event) => event.type === 'combo_field' && event.skillName === 'Acid Bomb');
      assert.equal(field.expiresAt - field.at, 6);
      assert.equal(
        result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === 'Acid Bomb').length,
        7
      );
      assert.ok(result.events.some((event) => event.type === 'buff' && event.sourceId === TRAIT.HGH));
    }
  },
  {
    name: 'Streamlined Kits',
    trait: TRAIT.STREAMLINED_KITS,
    rotation: ['Grenade Kit', wait],
    verify: (result) => {
      assert.ok(result.events.some((event) => event.type === 'buff' && event.sourceId === TRAIT.STREAMLINED_KITS));
      assert.ok(result.resolvedEvents.some((event) => event.type === 'damage' && event.name === 'Drop Mine'));
    }
  },
  {
    name: 'Optimized Activation',
    trait: TRAIT.OPTIMIZED_ACTIVATION,
    rotation: ['Regenerating Mist', wait],
    verify: (result) =>
      assert.ok(result.events.some((event) => event.type === 'buff' && event.sourceId === TRAIT.OPTIMIZED_ACTIVATION))
  },
  {
    name: 'Static Discharge',
    trait: TRAIT.STATIC_DISCHARGE,
    rotation: ['Regenerating Mist', wait],
    verify: (result) =>
      assert.ok(result.resolvedEvents.some((event) => event.type === 'damage' && event.name === 'Static Discharge'))
  },
  {
    name: 'Kinetic Battery',
    trait: TRAIT.KINETIC_BATTERY,
    rotation: ['Regenerating Mist', 'Grenade Barrage', 'Mine Field', 'Healing Mist', 'Med Pack Drop'],
    verify: (result) =>
      assert.ok(result.events.some((event) => event.type === 'buff' && event.kind === 'kinetic-battery'))
  }
];

for (const { name, trait, extraTraits = [], rotation, config, verify } of traitCases) {
  test(`${name} remains behaviorally reachable through the Core trait dispatcher`, () => {
    verify(simulate(rotation, { ...config, selectedTraitIds: [trait, ...extraTraits] }));
  });
}

test('Engineer critical and scheduled-event definitions preserve their public order', () => {
  assert.deepEqual(
    engineerCoreCriticalHitDefinitions.map((definition) => definition.id),
    ['engineer.core.serrated-steel', 'engineer.core.no-scope', 'engineer.core.incendiary-powder-player']
  );
  assert.deepEqual(
    engineerCoreSchedulerHooks.onEventScheduled.map((hook) => hook.id),
    ['engineer.mine-field', 'engineer.hgh-duration']
  );
});
