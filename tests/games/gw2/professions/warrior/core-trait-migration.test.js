import assert from 'node:assert/strict';
import test from 'node:test';

import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { createWarriorCoreState } from '#gw2/professions/warrior/core/state.js';
import { observeWarriorEvent } from '#gw2/professions/warrior/core/traits/index.js';
import {
  applyFuriousBurst,
  applySunderingBurst,
  reactToWarriorDamage
} from '#gw2/professions/warrior/core/traits/arms.js';
import { applyCullTheWeak, applyStalwartStrength } from '#gw2/professions/warrior/core/traits/defense.js';
import { applyAggressiveOnslaught } from '#gw2/professions/warrior/core/traits/strength.js';

// Each migrated final gate must keep its key, eligibility and claim-before-effect ordering.
for (const [key, trait, handler, literalDuration] of [
  ['lesserSignetMight', TRAIT.SIGNET_MASTERY, reactToWarriorDamage],
  ['stalwartStrength', TRAIT.STALWART_STRENGTH, applyStalwartStrength],
  ['aggressiveOnslaught', TRAIT.AGGRESSIVE_ONSLAUGHT, applyAggressiveOnslaught],
  ['cullTheWeak', TRAIT.CULL_THE_WEAK, applyCullTheWeak, 5],
  ['sunderingBurst', TRAIT.SUNDERING_BURST, (c, e) => applySunderingBurst(c, e, true, 1)],
  ['furiousBurst', TRAIT.FURIOUS_BURST, (c) => applyFuriousBurst(c, { id: 1, name: 'Swap Weapons' })]
]) {
  test(`${key} reserves only its eligible opportunity before effects`, () => {
    for (const duration of literalDuration == null ? [2, 0] : [literalDuration]) {
      const core = createWarriorCoreState();
      core.traitProcReadyAt.unrelated = 99;
      const catalog = warriorProfession.catalog;
      const profiles = new Map(catalog.balanceProfilesById);
      profiles.set(trait, { ...profiles.get(trait), internalCooldown: duration });
      let emitted = 0;
      const context = {
        config: { selectedTraitIds: [], target: { health: 100, startingHealthFraction: 0.4 } },
        catalog: { ...catalog, balanceProfilesById: profiles },
        profession: warriorProfession,
        state: { time: 1, profession: { core, specialization: { kind: 'Core', state: {} } } },
        effectiveEnd: 1,
        helpers: { skillsById: catalog.skillsById },
        query: { statsAt: () => ({}) },
        recordProc() {},
        emit(event) {
          assert.equal(core.traitProcReadyAt[key], event.at + duration);
          emitted += 1;
          return event;
        },
        emitDerived(_cause, event) {
          return this.emit(event);
        },
        queue: {
          enqueue(event) {
            return context.emit(event);
          }
        }
      };
      const opportunity = (at) => {
        context.effectiveEnd = at;
        handler(context, { type: 'control', at, actorType: 'player', coefficient: 1 });
      };

      opportunity(1);
      assert.deepEqual(core.traitProcReadyAt, { unrelated: 99 });
      context.config.selectedTraitIds = [trait];
      opportunity(1);
      assert.ok(emitted > 0);
      const count = emitted;
      opportunity(1 + duration);
      opportunity(1 + duration + 0.0000004);
      assert.equal(emitted, count);
      opportunity(1 + duration + 0.000001);
      assert.ok(emitted > count);
      assert.equal(core.traitProcReadyAt.unrelated, 99);
    }
  });
}

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

// Keep the proc on the scheduler observer path, including eligibility and reentrant emission order.
test('Opportunist claims its ICD before Fury and target-control bookkeeping', () => {
  for (const internalCooldown of [1, 0]) {
    const core = createWarriorCoreState();
    const events = [];
    const catalog = warriorProfession.catalog;
    const profiles = new Map(catalog.balanceProfilesById);
    profiles.set(TRAIT.OPPORTUNIST, { ...profiles.get(TRAIT.OPPORTUNIST), internalCooldown });
    const control = { type: 'control', actorType: 'player', at: 1, skillName: 'Fixture control' };
    const context = {
      config: { selectedTraitIds: [TRAIT.OPPORTUNIST] },
      catalog: { ...catalog, balanceProfilesById: profiles },
      profession: warriorProfession,
      state: { time: 1, profession: { core, specialization: { kind: 'Core', state: {} } } },
      events,
      emitDerived(_cause, event) {
        assert.equal(core.traitProcReadyAt.opportunist, event.at + internalCooldown);
        // The first grant precedes both the control window and any induced same-time opportunity.
        if (events.length === 0) assert.equal(core.targetControlledUntil, 0);
        events.push(event);
        observeWarriorEvent(context, { ...control, at: event.at });
        return event;
      }
    };
    for (const event of [
      { ...control, actorType: 'summon' },
      { ...control, type: 'condition', condition: 'Bleeding' },
      { ...control, type: 'condition', condition: 'Immobilized', actorType: 'effect' }
    ])
      observeWarriorEvent(context, event);
    context.config.selectedTraitIds = [];
    observeWarriorEvent(context, control);
    assert.deepEqual(core.traitProcReadyAt, {});
    assert.equal(core.adrenaline, 0);
    assert.equal(events.length, 0);
    core.targetControlledUntil = 0;
    context.config.selectedTraitIds = [TRAIT.OPPORTUNIST];
    observeWarriorEvent(context, control);
    assert.equal(events.length, 1);
    assert.equal(core.adrenaline, 5);
    assert.equal(events[0].sourceId, TRAIT.OPPORTUNIST);
    assert.equal(events[0].kind, 'fury');
    assert.equal(events[0].duration, 3);
    assert.equal(core.targetControlledUntil, 2);
    observeWarriorEvent(context, { ...control, at: 1 + internalCooldown });
    assert.equal(events.length, 1);
    observeWarriorEvent(context, { ...control, type: 'condition', condition: 'Immobilized', at: 3 });
    assert.equal(events.length, 2);
    assert.equal(core.adrenaline, 10);
  }
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
    rotation: ['Eviscerate', { type: 'wait', durationMs: 1 }],
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
    rotation: ['Signet of Might', { type: 'wait', durationMs: 1 }],
    verify: (result) => {
      const action = result.events.find((event) => event.type === 'action' && event.skillName === 'Signet of Might');
      const mastery = result.events.find((event) => event.kind === 'signet-mastery');
      assert.equal(mastery.at, action.endsAt);
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
    rotation: ['Eviscerate', { type: 'wait', durationMs: 1 }],
    config: { initialResource: 30 },
    verify: (result) => assert.ok(result.events.some((event) => event.sourceId === TRAIT.BURST_MASTERY))
  }
];

for (const { name, trait, extraTraits = [], rotation, config, verify } of traitCases) {
  test(`${name} remains behaviorally reachable through the Core trait dispatcher`, () => {
    verify(simulate(rotation, { ...config, selectedTraitIds: [trait, ...extraTraits] }));
  });
}
