import assert from 'node:assert/strict';
import test from 'node:test';

import { runCombatEngine } from '#gw2/platform/combat-engine/run.js';
import { damageEvents, encounter, flatStrike, skill } from '../../fixtures/combat-engine.js';

// Side-effect, equipment, and stacking contracts reached by the Willbender reference build. Each expectation was
// confirmed against the pinned C++ reference with identical audit event streams.

function run(encounterConfiguration) {
  const result = runCombatEngine({ encounter: encounterConfiguration });
  assert.equal(result.ok, true, result.message);
  return result;
}

const castEnds = (result) =>
  result.events.filter((event) => event.type === 'skill_cast_end').map((event) => [event.timeMs, event.skill]);

test('counter modifiers apply before triggers in the same finished-casting stage', () => {
  const result = run(
    encounter({
      skills: [skill('Build', { tags: ['BUILDER'] }), flatStrike('Payoff', 500)],
      casts: [
        ['Build', 0],
        ['Build', 10],
        ['Build', 20],
        ['Build', 30]
      ],
      playerBuild: {
        counters: [{ counter_key: 'Charges' }],
        permanent_unique_effects: [
          {
            unique_effect_key: 'Charger',
            counter_modifiers: [
              {
                condition: {
                  only_applies_on_finished_casting: true,
                  only_applies_on_finished_casting_skill_with_tag: 'BUILDER'
                },
                counter_key: 'Charges',
                operation: 'add',
                value: 1
              }
            ],
            skill_triggers: [
              {
                condition: {
                  only_applies_on_finished_casting: true,
                  only_applies_on_finished_casting_skill_with_tag: 'BUILDER',
                  threshold: {
                    threshold_type: 'lower_bound_inclusive',
                    threshold_value: 3,
                    counter_value_subject_to_threshold: 'Charges'
                  }
                },
                skill_key: 'Payoff'
              }
            ]
          }
        ]
      }
    })
  );

  // The third build reaches the threshold; its triggered child casts within the same tick's rotation pass.
  assert.deepEqual(
    damageEvents(result).map((event) => [event.timeMs, event.sourceSkill]),
    [
      [20, 'Payoff'],
      [30, 'Payoff']
    ]
  );
  assert.deepEqual(result.counterValues, { Charges: 4 });
});

test('cooldown modifiers advance recharge progress of another skill', () => {
  const result = run(
    encounter({
      skills: [flatStrike('Big', 100, { cooldown: [10000, 10000] }), flatStrike('Poke', 1)],
      casts: [
        ['Big', 0],
        ['Poke', 10],
        ['Poke', 20],
        ['Big', 30]
      ],
      playerBuild: {
        permanent_unique_effects: [
          {
            unique_effect_key: 'Haste',
            cooldown_modifiers: [
              {
                condition: { only_applies_on_strikes: true, only_applies_on_strikes_by_skill: 'Poke' },
                skill_key: 'Big',
                operation: 'subtract',
                value: 3000
              }
            ]
          }
        ]
      }
    })
  );

  assert.deepEqual(castEnds(result).at(-1), [4001, 'Big']);
});

test('removed condition stacks are destroyed without paying their accrued damage', () => {
  const result = run(
    encounter({
      skills: [
        skill('Self Burn', {
          pulse_on_tick_list: [[0], [0]],
          on_pulse_effect_applications: [
            { effect: 'BURNING', base_duration_ms: 10000, num_stacks: 2, direction: 'SELF' }
          ]
        }),
        skill('Cleanse', {
          effect_removals: [
            {
              condition: { only_applies_on_finished_casting: true, only_applies_on_finished_casting_skill: 'Cleanse' },
              effect: 'BURNING',
              num_stacks: 1
            }
          ]
        })
      ],
      casts: [
        ['Self Burn', 0],
        ['Cleanse', 500]
      ],
      playerAttributes: [['max_health', 1_000_000]],
      terminationConditions: [{ type: 'TIME', time: 2001 }]
    })
  );

  assert.deepEqual(
    damageEvents(result).map((event) => [event.timeMs, event.actor, event.damage]),
    [
      [1000, 'player', 131],
      [2000, 'player', 131]
    ]
  );
});

test('weapon swap changes the active set used by weapon conditions and strength', () => {
  const result = run(
    encounter({
      skills: [
        skill('Pistol Shot', {
          weapon_type: 'pistol',
          damage_coefficient: 1,
          strike_on_tick_list: [[0], [0]],
          can_critical_strike: false
        }),
        skill('Sword Slash', {
          weapon_type: 'sword',
          damage_coefficient: 1,
          strike_on_tick_list: [[0], [0]],
          can_critical_strike: false
        }),
        skill('Weapon Swap', { weapon_swap: true, cast_duration: [100, 100], cooldown: [10000, 10000] })
      ],
      casts: [
        ['Pistol Shot', 0],
        ['Weapon Swap', 10],
        ['Sword Slash', 200]
      ],
      playerAttributes: [['power', 2000]],
      playerBuild: {
        weapons: [
          { type: 'pistol', position: 'main_hand', set: 'set_1' },
          { type: 'sword', position: 'main_hand', set: 'set_2' }
        ],
        permanent_unique_effects: [
          {
            unique_effect_key: 'Sword Mastery',
            attribute_modifiers: [
              { condition: { weapon_type: 'sword' }, attribute: 'outgoing_strike_damage_multiplier', multiplier: 2 }
            ]
          }
        ]
      }
    })
  );

  // Both weapons average 1000 strength; only the swapped-in sword satisfies the doubling condition.
  assert.deepEqual(
    damageEvents(result).map((event) => [event.sourceSkill, event.damage]),
    [
      ['Pistol Shot', 1448],
      ['Sword Slash', 2896]
    ]
  );
});

test('starting a skill cancels the remaining ticks of listed skills', () => {
  const result = run(
    encounter({
      skills: [
        skill('Channel', {
          weapon_type: 'empty_handed',
          skill_ticks: [0, 1000, 2000].map((onTick) => ({
            on_tick: onTick,
            strike: true,
            flat_damage: 1,
            can_critical_strike: false
          }))
        }),
        skill('Interrupt', { skills_to_cancel: ['Channel'] })
      ],
      casts: [
        ['Channel', 0],
        ['Interrupt', 1500]
      ],
      terminationConditions: [{ type: 'TIME', time: 3000 }]
    })
  );

  assert.deepEqual(
    damageEvents(result).map((event) => event.timeMs),
    [1, 1000]
  );
});

test('unique effects honor duration stacking caps and stored-stack limits', () => {
  const result = run(
    encounter({
      skills: [
        skill('Extend', {
          pulse_on_tick_list: [[0], [0]],
          on_pulse_effect_applications: [
            {
              unique_effect: { unique_effect_key: 'Extended', stacking_type: 'duration', max_duration: 5000 },
              base_duration_ms: 3000,
              direction: 'SELF'
            }
          ]
        }),
        skill('Stack', {
          pulse_on_tick_list: [[0], [0]],
          on_pulse_effect_applications: [
            {
              unique_effect: { unique_effect_key: 'Stacked', max_stored_stacks: 2 },
              base_duration_ms: 2000,
              num_stacks: 3,
              direction: 'SELF'
            }
          ]
        })
      ],
      casts: [
        ['Extend', 0],
        ['Stack', 0],
        ['Extend', 1000]
      ],
      terminationConditions: [{ type: 'TIME', time: 7000 }]
    })
  );

  assert.deepEqual(
    result.events.filter((event) => event.type === 'effect_expired').map((event) => [event.timeMs, event.uniqueEffect]),
    [
      [2002, 'Stacked'],
      [2002, 'Stacked'],
      [6000, 'Extended']
    ]
  );
});

test('effect-application triggers filter by the applied effect type', () => {
  const result = run(
    encounter({
      skills: [
        skill('Bleed', {
          pulse_on_tick_list: [[0], [0]],
          on_pulse_effect_applications: [{ effect: 'BLEEDING', base_duration_ms: 1000, direction: 'OUTGOING' }]
        }),
        skill('Burn', {
          pulse_on_tick_list: [[0], [0]],
          on_pulse_effect_applications: [{ effect: 'BURNING', base_duration_ms: 1000, direction: 'OUTGOING' }]
        }),
        flatStrike('Proc', 50)
      ],
      casts: [
        ['Burn', 0],
        ['Bleed', 10]
      ],
      playerBuild: {
        permanent_unique_effects: [
          {
            unique_effect_key: 'Hook',
            unchained_skill_triggers: [
              {
                condition: {
                  only_applies_on_effect_application: true,
                  only_applies_on_effect_application_of_type: 'BLEEDING'
                },
                skill_key: 'Proc'
              }
            ]
          }
        ]
      }
    })
  );

  assert.deepEqual(
    damageEvents(result).map((event) => [event.timeMs, event.sourceSkill]),
    [[11, 'Proc']]
  );
});

const whirlEncounter = (playerBuild) =>
  encounter({
    skills: [
      skill('Fire Field', { combo_field: 'fire', pulse_on_tick_list: [[3000], [3000]] }),
      skill('Spin', { whirl_finisher_on_tick_list: [[0], [0]] }),
      flatStrike('Burning Bolts', 30)
    ],
    casts: [
      ['Fire Field', 0],
      ['Spin', 100]
    ],
    playerBuild
  });

// Combo results are content: the finisher owner maps each field type to the skill it spawns.
test('a whirl finisher in an active combo field spawns the skill mapped to that field', () => {
  const mapped = run(whirlEncounter({ whirl_finisher_skills: [{ combo_field: 'fire', skill_key: 'Burning Bolts' }] }));
  const unmapped = run(whirlEncounter({ whirl_finisher_skills: [{ combo_field: 'ice', skill_key: 'Burning Bolts' }] }));

  assert.deepEqual(
    damageEvents(mapped).map((event) => [event.timeMs, event.sourceSkill]),
    [[101, 'Burning Bolts']]
  );
  assert.deepEqual(damageEvents(unmapped), []);
});

test('strikes from skills that skip on-strike hooks deal damage but fire no on-strike side effects', () => {
  const result = run(
    encounter({
      skills: [flatStrike('Lifesteal Proc', 325, { skip_on_strike_hooks: true }), flatStrike('Echo', 1)],
      casts: ['Lifesteal Proc'],
      playerBuild: {
        permanent_unique_effects: [
          {
            unique_effect_key: 'Echo Trait',
            unchained_skill_triggers: [{ condition: { only_applies_on_strikes: true }, skill_key: 'Echo' }]
          }
        ]
      }
    })
  );

  assert.deepEqual(
    damageEvents(result).map((event) => [event.timeMs, event.sourceSkill, event.damage]),
    [[1, 'Lifesteal Proc', 325]]
  );
});

// The shared core must not branch on skill names: only the flag (added for upstream input by the adapter) swaps sets.
test('a skill named like the reference weapon swap has no built-in behavior without its flag', () => {
  const result = runCombatEngine({
    encounter: encounter({
      skills: [
        skill('Sword Slash', { weapon_type: 'sword', damage_coefficient: 1, strike_on_tick_list: [[0], [0]] }),
        skill('Weapon Swap', { cast_duration: [100, 100], cooldown: [10000, 10000] })
      ],
      casts: [
        ['Weapon Swap', 0],
        ['Sword Slash', 200]
      ],
      playerBuild: {
        weapons: [
          { type: 'pistol', position: 'main_hand', set: 'set_1' },
          { type: 'sword', position: 'main_hand', set: 'set_2' }
        ]
      }
    })
  });

  assert.equal(result.code, 'rotation.cannot-cast');
});
