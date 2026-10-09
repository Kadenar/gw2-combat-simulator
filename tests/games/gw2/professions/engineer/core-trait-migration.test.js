import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import assert from 'node:assert/strict';
import test from 'node:test';

import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { ENGINEER_TRAIT_IDS as TRAIT, ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import { withProfile } from '#tests/helpers/catalog-overrides.js';
import { runEngineer } from '#tests/helpers/engineer-simulation.js';
import { createObservedProfessionSimulator } from '#tests/helpers/observed-runtime.js';

const baseConfig = Object.freeze({
  selectedSkillIds: [5857, 5805, 6161, 5933, 5868],
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
  return createObservedProfessionSimulator(engineerProfession, baseConfig)('Core', rotation, config);
}

const wait = { type: 'wait', durationMs: 100 };

// The profile owns offsets and repetitions; ordinary toolbelts still trigger at their completion boundary.
test('Optimized Activation materializes delayed repeated Vigor and respects effect removal', () => {
  for (const effects of [
    [],
    [
      {
        type: 'boon',
        name: 'vigor',
        boon: 'vigor',
        duration: 4,
        stacks: 1,
        atMs: 500,
        applications: 2,
        intervalMs: 200
      }
    ]
  ]) {
    const result = runEngineer(
      ['Regenerating Mist', { type: 'wait', durationMs: 1500 }],
      {
        ...baseConfig,
        selectedTraitIds: [TRAIT.OPTIMIZED_ACTIVATION]
      },
      {
        extend: (native) => ({
          catalog: effects.length
            ? withProfile(native.catalog, TRAIT.OPTIMIZED_ACTIVATION, { effects })
            : applyBalanceProfilePatch(native.catalog, {
                balanceProfiles: { [TRAIT.OPTIMIZED_ACTIVATION]: { removeEffects: [{ type: 'boon', all: true }] } }
              })
        })
      }
    );
    assert.deepEqual(result.warnings, []);
    const boons = result.events.filter((event) => event.sourceId === TRAIT.OPTIMIZED_ACTIVATION);
    assert.deepEqual(
      boons.map((event) => event.at),
      effects.length
        ? [0.5, 0.7].map((offset) =>
            Number((result.events.find((event) => event.type === 'action').endsAt + offset).toFixed(6))
          )
        : []
    );
  }
});

const traitCases = [
  {
    name: 'Grenadier',
    trait: TRAIT.GRENADIER,
    rotation: ['Healing Turret', { type: 'wait', durationMs: 1000 }],
    verify: (result) =>
      assert.ok(
        result.resolvedEvents.some((event) => event.type === 'damage' && event.sourceId === ID.LESSER_GRENADE_BARRAGE)
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
    verify: (result) => assert.ok(observedRuntime(result).buffs.get('thermal-vision').length > 0)
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
    config: { selectedSkillIds: [...baseConfig.selectedSkillIds, 5933] },
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
