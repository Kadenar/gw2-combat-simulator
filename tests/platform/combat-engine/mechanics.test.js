import assert from 'node:assert/strict';
import test from 'node:test';

import { runCombatEngine } from '#gw2/platform/combat-engine/run.js';
import { damageEvents, encounter, flatStrike, skill } from '../../fixtures/combat-engine.js';

// Every expectation in this file was confirmed against the pinned C++ reference by running the same encounter
// through scripts/analysis/gw2combat-reference tooling; the audit event streams matched exactly.

function run(encounterConfiguration, options = {}) {
  const result = runCombatEngine({ encounter: encounterConfiguration, ...options });
  assert.equal(result.ok, true, result.message);
  return result;
}

const empowered = (key, overrides = {}) =>
  skill(key, { weapon_type: 'empty_handed', damage_coefficient: 1, strike_on_tick_list: [[0], [0]], ...overrides });

test('strike damage uses the expected critical multiplier and floors once', () => {
  // 2000 power against HALF_POWER_ARMOR is 1000 before criticals; 1945 precision is a 50% chance at 150% damage.
  const result = run(
    encounter({
      skills: [empowered('Hit')],
      casts: ['Hit'],
      playerAttributes: [
        ['power', 2000],
        ['precision', 1945]
      ]
    })
  );

  assert.equal(result.totalDamage, 1250);
});

test('condition stacks pay elapsed lifetime on condition ticks and hold an expired remainder for the next one', () => {
  const result = run(
    encounter({
      skills: [
        skill('Ignite', {
          pulse_on_tick_list: [[0], [0]],
          on_pulse_effect_applications: [
            { effect: 'BURNING', base_duration_ms: 3000, num_stacks: 3, direction: 'OUTGOING' }
          ]
        })
      ],
      casts: ['Ignite'],
      terminationConditions: [{ type: 'TIME', time: 4001 }]
    })
  );

  // Applied on tick 1: 999 ms elapse by tick 1000, and the three stacks round as one group (392.6 -> 393).
  assert.deepEqual(
    damageEvents(result).map((event) => [event.timeMs, event.damage]),
    [1000, 1000, 1000, 2000, 2000, 2000, 3000, 3000, 3000]
      .map((tick) => [tick, 131])
      .concat([
        [4000, 0],
        [4000, 0],
        [4000, 0]
      ])
  );
  assert.deepEqual(
    result.events.filter((event) => event.type === 'effect_expired').map((event) => event.timeMs),
    [3001, 3001, 3001]
  );
});

test('duration-stacking boons extend up to the 30 second cap', () => {
  const result = run(
    encounter({
      skills: [
        skill('Fury', {
          pulse_on_tick_list: [[0], [0]],
          on_pulse_effect_applications: [{ effect: 'FURY', base_duration_ms: 20000, num_stacks: 2, direction: 'SELF' }]
        })
      ],
      casts: ['Fury'],
      terminationConditions: [{ type: 'TIME', time: 31000 }]
    })
  );

  assert.deepEqual(
    result.events.filter((event) => event.type === 'effect_expired').map((event) => [event.timeMs, event.effect]),
    [[30001, 'FURY']]
  );
});

test('might contributes power for at most 25 considered stacks', () => {
  const result = run(
    encounter({
      skills: [
        skill('Might', {
          pulse_on_tick_list: [[0], [0]],
          on_pulse_effect_applications: [
            { effect: 'MIGHT', base_duration_ms: 10000, num_stacks: 30, direction: 'SELF' }
          ]
        }),
        empowered('Hit')
      ],
      casts: ['Might', ['Hit', 10]]
    })
  );

  // 1000 + 25 * 30 power, halved by the fixture armor.
  assert.equal(result.totalDamage, 875);
});

test('attribute conversions read post-modifier values and never chain', () => {
  const result = run(
    encounter({
      skills: [empowered('Hit')],
      casts: ['Hit'],
      playerBuild: {
        permanent_unique_effects: [
          {
            unique_effect_key: 'Stats',
            attribute_modifiers: [{ attribute: 'power', multiplier: 2 }],
            attribute_conversions: [
              { from: 'power', to: 'condition_damage', multiplier: 0.1 },
              { from: 'condition_damage', to: 'power', multiplier: 1 }
            ]
          }
        ]
      }
    })
  );

  // Power doubles to 2000; the 200 converted condition damage is not fed back into power.
  assert.equal(result.totalDamage, 1000);
});

test('a chained trigger fires once per tick and its proc shares the owner recharge', () => {
  const result = run(
    encounter({
      skills: [
        flatStrike('Proc', 100, { cooldown: [2000, 2000] }),
        flatStrike('Hit', 1000, {
          strike_on_tick_list: [
            [0, 0],
            [0, 0]
          ]
        })
      ],
      casts: ['Hit', ['Hit', 1000], ['Hit', 2500]],
      playerBuild: {
        permanent_unique_effects: [
          {
            unique_effect_key: 'Proc Trait',
            skill_triggers: [
              { condition: { only_applies_on_strikes: true, depends_on_skill_off_cooldown: 'Proc' }, skill_key: 'Proc' }
            ]
          }
        ]
      }
    })
  );

  // Two strikes on tick 1 spawn one proc, cast by a child actor on tick 2; it recharges the owner's Proc until tick 2002.
  assert.deepEqual(
    damageEvents(result).map((event) => [event.timeMs, event.sourceSkill]),
    [
      [1, 'Hit'],
      [1, 'Hit'],
      [2, 'Proc'],
      [1000, 'Hit'],
      [1000, 'Hit'],
      [2500, 'Hit'],
      [2500, 'Hit'],
      [2501, 'Proc']
    ]
  );
  assert.ok(damageEvents(result).every((event) => event.sourceActor === 'player'));
});

test('ammo recharges one charge at a time and the rotation waits for it', () => {
  const result = run(
    encounter({
      skills: [flatStrike('Charge', 1, { ammo: 2, cooldown: [1000, 1000] })],
      casts: ['Charge', 'Charge', 'Charge']
    })
  );

  assert.deepEqual(
    result.events.filter((event) => event.type === 'skill_cast_end').map((event) => event.timeMs),
    [1, 2, 1001]
  );
});

test('recharge starts when a cast animation completes', () => {
  const result = run(
    encounter({
      skills: [
        flatStrike('Slow', 10, {
          cast_duration: [500, 400],
          cooldown: [1000, 800],
          strike_on_tick_list: [[250], [200]]
        })
      ],
      casts: ['Slow', 'Slow']
    })
  );

  assert.deepEqual(
    result.events.filter((event) => event.type === 'skill_cast_end').map((event) => event.timeMs),
    [500, 1999]
  );
  assert.deepEqual(
    damageEvents(result).map((event) => event.timeMs),
    [250, 1749]
  );
});

test('conditional skill groups cast the first member whose condition holds', () => {
  const result = run(
    encounter({
      skills: [flatStrike('Form Attack', 200), flatStrike('Normal Attack', 100)],
      casts: ['Attack'],
      playerBuild: {
        permanent_unique_effects: [{ unique_effect_key: 'Form' }],
        conditional_skill_groups: [
          {
            skill_key: 'Attack',
            conditional_skill_keys: [
              { condition: { unique_effect_on_source: 'Form' }, skill_key: 'Form Attack' },
              { skill_key: 'Normal Attack' }
            ]
          }
        ]
      }
    })
  );

  assert.deepEqual(
    damageEvents(result).map((event) => [event.sourceSkill, event.damage]),
    [['Form Attack', 200]]
  );
});

test('termination checks a downed actor first, then conditions in configured order', () => {
  const big = [flatStrike('Big', 6000)];
  const damage = run(
    encounter({
      skills: big,
      casts: ['Big'],
      targetAttributes: [['max_health', 10000]],
      terminationConditions: [
        { type: 'DAMAGE', actor: 'golem', damage: 5000 },
        { type: 'TIME', time: 100 }
      ]
    })
  );
  const downed = run(
    encounter({
      skills: big,
      casts: ['Big'],
      targetAttributes: [['max_health', 6000]],
      terminationConditions: [{ type: 'TIME', time: 100 }]
    })
  );
  const time = run(
    encounter({ skills: big, casts: [['Big', 1000]], terminationConditions: [{ type: 'TIME', time: 500 }] })
  );

  assert.deepEqual([damage.endTick, damage.terminatedBy], [1, 'DAMAGE']);
  assert.deepEqual([downed.endTick, downed.terminatedBy], [1, 'downstate']);
  assert.deepEqual([time.endTick, time.terminatedBy, time.totalDamage], [500, 'TIME', 0]);
});

test('active-skill termination waits for scheduled skill ticks after the rotation ends', () => {
  const result = run(
    encounter({
      skills: [
        skill('Channel', {
          weapon_type: 'empty_handed',
          skill_ticks: [
            { on_tick: 0, strike: true, flat_damage: 5, can_critical_strike: false },
            { on_tick: 1500, strike: true, flat_damage: 7, can_critical_strike: false }
          ]
        })
      ],
      casts: ['Channel'],
      terminationConditions: [{ type: 'ACTIVE_SKILLS', actor: 'player' }]
    })
  );

  assert.deepEqual([result.endTick, result.terminatedBy, result.totalDamage], [1500, 'ACTIVE_SKILLS', 12]);
});

test('a due rotation entry that cannot be cast fails the run at that tick', () => {
  const result = runCombatEngine({
    encounter: encounter({ skills: [flatStrike('Sword Hit', 1, { weapon_type: 'sword' })], casts: ['Sword Hit'] })
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'rotation.cannot-cast');
  assert.equal(result.tick, 1);
  assert.match(result.message, /skill not available on this weapon set/);
});
