import assert from 'node:assert/strict';
import test from 'node:test';

import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { warriorProfession } from '#gw2/professions/warrior/definition.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';

const baseConfig = Object.freeze({
  stats: {
    power: 2000,
    precision: 1500,
    ferocity: 500,
    conditionDamage: 1000,
    expertise: 0,
    vitality: 1000
  },
  target: { armor: 2597, health: 3_970_000, defiant: true, conditions: {} }
});

// Run the smallest Core rotation that reaches a migrated trait through the public dispatcher.
function simulate(rotation, config = {}) {
  return simulateGw2({
    profession: warriorProfession,
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

const traitCases = [
  {
    name: 'Reckless Dodge',
    trait: TRAIT.RECKLESS_DODGE,
    rotation: ['Dodge'],
    verify: (result) => assert.ok(result.events.some((event) => event.name === 'Reckless Dodge'))
  },
  {
    name: 'Building Momentum',
    trait: TRAIT.BUILDING_MOMENTUM,
    rotation: ['Dodge', 'Eviscerate'],
    config: { initialResource: 30 },
    verify: (result) =>
      assert.equal(
        result.endState.profession.endurance -
          simulate(['Dodge', 'Eviscerate'], { initialResource: 30 }).endState.profession.endurance,
        15
      )
  },
  {
    name: 'Brave Stride',
    trait: TRAIT.BRAVE_STRIDE,
    rotation: ['Kick'],
    verify: (result) => assert.ok(result.events.some((event) => event.sourceId === TRAIT.BRAVE_STRIDE))
  },
  {
    name: 'Peak Performance',
    trait: TRAIT.PEAK_PERFORMANCE,
    rotation: ['Kick'],
    verify: (result) => assert.ok(result.events.some((event) => event.kind === 'peak-performance'))
  },
  {
    name: 'Body Blow',
    trait: TRAIT.BODY_BLOW,
    rotation: ['Stomp'],
    verify: (result) =>
      assert.ok(result.events.some((event) => event.sourceId === TRAIT.BODY_BLOW && event.condition === 'Weakness'))
  },
  {
    name: "Berserker's Power",
    trait: TRAIT.BERSERKERS_POWER,
    rotation: ['Eviscerate'],
    config: { initialResource: 30 },
    verify: (result) => assert.equal(result.events.find((event) => event.kind === 'berserkers-power')?.stacks, 4)
  },
  {
    name: 'Aggressive Onslaught',
    trait: TRAIT.AGGRESSIVE_ONSLAUGHT,
    rotation: ['Stomp'],
    verify: (result) => assert.ok(result.events.some((event) => event.sourceId === TRAIT.AGGRESSIVE_ONSLAUGHT))
  },
  {
    name: 'Marching Orders',
    trait: TRAIT.MARCHING_ORDERS,
    rotation: ['Eviscerate'],
    config: { initialResource: 30 },
    verify: (result) => assert.ok(result.events.some((event) => event.sourceId === TRAIT.MARCHING_ORDERS))
  },
  {
    name: 'Leg Specialist',
    trait: TRAIT.LEG_SPECIALIST,
    rotation: ['Throw Axe'],
    verify: (result) =>
      assert.ok(
        result.events.some((event) => event.sourceId === TRAIT.LEG_SPECIALIST && event.condition === 'Immobilized')
      )
  },
  {
    name: "Soldier's Comfort",
    trait: TRAIT.SOLDIERS_COMFORT,
    extraTraits: [TRAIT.MARCHING_ORDERS],
    rotation: ['Eviscerate'],
    config: { initialResource: 30 },
    verify: (result) => assert.ok(result.events.some((event) => event.sourceId === TRAIT.SOLDIERS_COMFORT))
  },
  {
    name: 'Empower Allies',
    trait: TRAIT.EMPOWER_ALLIES,
    rotation: [{ type: 'wait', durationMs: 100 }],
    verify: (result) => assert.ok(result.events.some((event) => event.sourceId === TRAIT.EMPOWER_ALLIES))
  },
  {
    name: 'Martial Cadence',
    trait: TRAIT.MARTIAL_CADENCE,
    extraTraits: [TRAIT.MARCHING_ORDERS],
    rotation: ['Eviscerate'],
    config: { initialResource: 30 },
    verify: (result) => assert.ok(result.events.some((event) => event.sourceId === TRAIT.MARTIAL_CADENCE))
  },
  {
    name: 'Phalanx Strength',
    trait: TRAIT.PHALANX_STRENGTH,
    rotation: ['Signet of Might'],
    verify: (result) =>
      assert.ok(
        result.events.some(
          (event) => event.sourceId === TRAIT.PHALANX_STRENGTH && event.audience?.recipients === 'party'
        )
      )
  },
  {
    name: 'Thick Skin',
    trait: TRAIT.THICK_SKIN,
    rotation: ['Mending'],
    verify: (result) => assert.ok(result.events.some((event) => event.sourceId === TRAIT.THICK_SKIN))
  },
  {
    name: 'Cull the Weak',
    trait: TRAIT.CULL_THE_WEAK,
    rotation: ['Eviscerate'],
    config: { initialResource: 30 },
    verify: (result) =>
      assert.ok(result.events.some((event) => event.sourceId === TRAIT.CULL_THE_WEAK && event.condition === 'Weakness'))
  },
  {
    name: 'Merciless Hammer',
    trait: TRAIT.MERCILESS_HAMMER,
    rotation: ['Kick'],
    config: { initialResource: 0 },
    verify: (result) => assert.equal(result.endState.profession.adrenaline, 8)
  },
  {
    name: 'Stalwart Strength',
    trait: TRAIT.STALWART_STRENGTH,
    rotation: ['Kick'],
    verify: (result) => assert.ok(result.events.some((event) => event.sourceId === TRAIT.STALWART_STRENGTH))
  },
  {
    name: 'Furious Burst',
    trait: TRAIT.FURIOUS_BURST,
    rotation: ['Swap Weapons'],
    verify: (result) => assert.ok(result.events.some((event) => event.sourceId === TRAIT.FURIOUS_BURST))
  },
  {
    name: 'Bloodlust',
    trait: TRAIT.BLOODLUST,
    rotation: ['Precise Cut', 'Focused Slash', 'Keen Strike', 'Precise Cut'],
    config: { primaryWeapon: 'Dagger', stats: { precision: 10_000 } },
    verify: (result) => assert.ok(result.events.some((event) => event.sourceId === TRAIT.BLOODLUST))
  },
  {
    name: 'Signet Mastery',
    trait: TRAIT.SIGNET_MASTERY,
    rotation: ['Signet of Might'],
    verify: (result) => {
      const action = result.events.find((event) => event.type === 'action' && event.skillName === 'Signet of Might');
      const mastery = result.events.find((event) => event.kind === 'signet-mastery');
      assert.ok(mastery.at > action.endsAt);
    }
  },
  {
    name: 'Opportunist',
    trait: TRAIT.OPPORTUNIST,
    rotation: ['Kick'],
    verify: (result) => assert.ok(result.events.some((event) => event.sourceId === TRAIT.OPPORTUNIST))
  },
  {
    name: 'Sundering Burst',
    trait: TRAIT.SUNDERING_BURST,
    rotation: ['Eviscerate'],
    config: { initialResource: 30 },
    verify: (result) => assert.ok(result.events.some((event) => event.sourceId === TRAIT.SUNDERING_BURST))
  },
  {
    name: 'Burst Precision',
    trait: TRAIT.BURST_PRECISION,
    rotation: ['Eviscerate'],
    config: { initialResource: 30 },
    verify: (result) => assert.equal(result.events.find((event) => event.kind === 'burst-precision')?.duration, 4)
  },
  {
    name: 'Furious',
    trait: TRAIT.FURIOUS,
    rotation: ['Throw Axe'],
    config: { stats: { precision: 10_000 } },
    verify: (result) => assert.ok(result.events.some((event) => event.kind === 'furious-surge'))
  },
  {
    name: 'Versatile Rage',
    trait: TRAIT.VERSATILE_RAGE,
    rotation: ['Swap Weapons'],
    config: { initialResource: 0 },
    verify: (result) => assert.equal(result.endState.profession.adrenaline, 5)
  },
  {
    name: 'Burst Mastery',
    trait: TRAIT.BURST_MASTERY,
    rotation: ['Eviscerate'],
    config: { initialResource: 30 },
    verify: (result) => assert.ok(result.events.some((event) => event.sourceId === TRAIT.BURST_MASTERY))
  }
];

for (const { name, trait, extraTraits = [], rotation, config, verify } of traitCases) {
  test(`${name} remains behaviorally reachable through the Core trait dispatcher`, () => {
    verify(simulate(rotation, { ...config, selectedTraitIds: [trait, ...extraTraits] }));
  });
}
