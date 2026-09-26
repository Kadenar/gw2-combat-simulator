import assert from 'node:assert/strict';
import test from 'node:test';
import { createLiveProfessionSimulator, observeGw2Runtime, runtimeFor } from '#tests/helpers/live-runtime.js';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { canonicalTime } from '#kernel/core/clock.js';

// Each live trigger must claim only its own gate before emitting its effects.
for (const [key, trait, trigger, literalDuration] of [
  ['lesserSignetMight', TRAIT.SIGNET_MASTERY, 'damage'],
  ['stalwartStrength', TRAIT.STALWART_STRENGTH, 'control'],
  ['aggressiveOnslaught', TRAIT.AGGRESSIVE_ONSLAUGHT, 'control'],
  ['cullTheWeak', TRAIT.CULL_THE_WEAK, 'damage', 5],
  ['sunderingBurst', TRAIT.SUNDERING_BURST, 'damage'],
  ['furiousBurst', TRAIT.FURIOUS_BURST, 'swap'],
  ['opportunist', TRAIT.OPPORTUNIST, 'control']
]) {
  test(key + ' preserves eligibility, exclusive readiness, and claim-before-effect ordering', () => {
    for (const duration of literalDuration == null ? [2, 0] : [literalDuration]) {
      for (const [at, selected, expected] of [
        [1, false, false],
        [1, true, false],
        [1.0000004, true, false],
        [1.000001, true, true]
      ]) {
        const config = {
          specialization: 'Core',
          selectedTraitIds: selected ? [trait] : [],
          initialResource: 0,
          primaryWeapon: 'Axe',
          swapPrimaryWeapon: 'Mace',
          target: { health: 1000000, startingHealthFraction: 0.4, armor: 2597 },
          stats: { power: 2000, precision: 4000 }
        };
        const native = warriorProfession.liveRuntimeFor(config);
        const profiles = new Map(native.catalog.balanceProfilesById);
        profiles.set(trait, { ...profiles.get(trait), internalCooldown: duration });
        let emitted = 0;
        const result = observeGw2Runtime({
          config,
          profession: {
            ...native,
            catalog: { ...native.catalog, balanceProfilesById: profiles },
            initialize(runtime) {
              native.initialize(runtime);
              const core = runtime.profession.core;
              core.traitProcReadyAt = { [key]: 1, unrelated: 99 };
              const enqueue = runtime.queue.enqueue.bind(runtime.queue);
              runtime.queue.enqueue = (event) => {
                if (event.sourceId === trait) {
                  assert.equal(core.traitProcReadyAt[key], canonicalTime(event.at + duration));
                  if (trait === TRAIT.OPPORTUNIST) assert.equal(core.targetControlledUntil, 0);
                  emitted += 1;
                }

                return enqueue(event);
              };

              if (trigger !== 'swap')
                runtime.emit({
                  type: trigger,
                  at,
                  actorType: 'player',
                  source: 'warrior',
                  sourceId: ID.KILL_SHOT,
                  skillId: ID.KILL_SHOT,
                  skillName: 'Kill Shot',
                  activationId: 'burst',
                  coefficient: 1,
                  forceCrit: true,
                  weaponStrengthProfileId: 'weapon.rifle',
                  controlKind: 'stun',
                  duration: 1
                });
            }
          },
          rotation: [{ type: 'wait', durationMs: at * 1000 }, ...(trigger === 'swap' ? ['Swap Weapons'] : [])]
        });
        assert.deepEqual(result.warnings, []);
        const core = runtimeFor(result).profession.core;
        assert.equal(emitted > 0, expected);
        assert.equal(core.traitProcReadyAt[key], expected ? canonicalTime(at + duration) : 1);
        assert.equal(core.traitProcReadyAt.unrelated, 99);
      }
    }
  });
}

// Ineligible control and conditions cannot consume Opportunist's shared player-only gate.
test('Opportunist ignores summons, effect immobilization, and unrelated player conditions', () => {
  const config = { specialization: 'Core', selectedTraitIds: [TRAIT.OPPORTUNIST], initialResource: 0 };
  const native = warriorProfession.liveRuntimeFor(config);
  const result = observeGw2Runtime({
    config,
    rotation: [{ type: 'wait', durationMs: 1000 }],
    profession: {
      ...native,
      initialize(runtime) {
        native.initialize(runtime);
        for (const event of [
          { type: 'control', actorType: 'summon', controlKind: 'stun' },
          { type: 'condition', actorType: 'effect', condition: 'Immobilized' },
          { type: 'condition', actorType: 'player', condition: 'Bleeding' }
        ])
          runtime.emit({ ...event, at: 1, source: 'fixture', sourceId: 'fixture', duration: 1, stacks: 1 });
      }
    }
  });
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(runtimeFor(result).profession.core.traitProcReadyAt, {});
  assert.equal(runtimeFor(result).profession.core.adrenaline, 0);
});

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

// Run each trait through the registered live Core and actual impact dispatcher.
const simulate = createLiveProfessionSimulator(warriorProfession, baseConfig);

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
        result.planningState.profession.endurance -
          simulate('Core', ['Dodge', 'Eviscerate'], { initialResource: 30 }).planningState.profession.endurance,
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
    verify: (result) => assert.equal(result.planningState.profession.adrenaline, 8)
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
    verify: (result) => assert.equal(result.planningState.profession.adrenaline, 5)
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
    verify(simulate('Core', rotation, { ...config, selectedTraitIds: [trait, ...extraTraits] }));
  });
}
