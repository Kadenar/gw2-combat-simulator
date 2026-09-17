import assert from 'node:assert/strict';
import test from 'node:test';
import { adaptRotation } from '#gw2/platform/simulation/combat-engine-adapter/rotation.js';
import { runCombatEngine } from '#gw2/platform/combat-engine/run.js';
import { encounter, flatStrike, skill } from '../fixtures/combat-engine.js';

/** Exercise translated ordinary skill data against the unchanged engine using minimal, profession-neutral scenarios. */
function adapt(skills, commands, authored = {}, build = {}) {
  const keys = new Map(skills.map((entry, index) => [index + 1, entry.skill_key]));
  const catalog = new Map(
    skills.map((entry, index) => [index + 1, { id: index + 1, name: entry.skill_key, ...authored[index + 1] }])
  );
  const input = encounter({
    skills,
    playerBuild: build,
    require_afk_skills: false,
    terminationConditions: [{ type: 'TIME', time: 50 }]
  });
  const compiled = adaptRotation(input.actors[0].build, commands, keys, catalog, false);
  input.actors[0].build = compiled.build;
  input.actors[0].rotation = compiled.rotation;
  const result = runCombatEngine({ encounter: input });
  assert.equal(result.ok, true, result.message);
  const starts = result.events.filter(
    (event) =>
      event.type === 'skill_cast_begin' && compiled.commandSkills.some((command) => command.skillKey === event.skill)
  );
  return { result, starts, compiled };
}

test('wait commands become inert cast-lane skills', () => {
  const { starts, compiled, result } = adapt(
    [skill('Cast', { cast_duration: [10, 10] }), skill('Next')],
    [
      { type: 'cast', skillId: 1 },
      { type: 'wait', durationMs: 5 },
      { type: 'cast', skillId: 2 }
    ]
  );
  assert.equal(starts[1].timeMs - starts[0].timeMs, 10);
  assert.equal(starts[2].timeMs - starts[1].timeMs, 5);
  assert.equal(result.totalDamage, 0);
  assert.ok(compiled.rotation.skill_casts.every((cast) => Object.keys(cast).sort().join(',') === 'cast_time_ms,skill'));
});

test('off-target variants suppress hostile parent and child packets but keep self effects', () => {
  const { result } = adapt(
    [
      flatStrike('Child', 100),
      skill('Prepare', {
        child_skill_keys: ['Child'],
        skill_ticks: [
          {
            on_tick: 0,
            pulse: true,
            on_pulse_effect_applications: [
              { effect: 'MIGHT', direction: 'SELF', base_duration_ms: 100 },
              { effect: 'BURNING', direction: 'OUTGOING', base_duration_ms: 100 }
            ]
          }
        ]
      }),
      flatStrike('Hit', 20)
    ],
    [
      { type: 'cast', skillId: 2, offTarget: true },
      { type: 'cast', skillId: 3 }
    ]
  );
  assert.equal(result.totalDamage, 20);
  assert.ok(result.events.some((event) => event.type === 'effect_application' && event.effect === 'MIGHT'));
  assert.ok(!result.events.some((event) => event.type === 'effect_application' && event.effect === 'BURNING'));
});

test('interrupted channel variants retain landed packets and recharge the original skill', () => {
  const { result, starts } = adapt(
    [
      skill('Channel', {
        executable: true,
        weapon_type: 'empty_handed',
        cast_duration: [20, 20],
        cooldown: [12, 12],
        skill_ticks: [2, 15].map((on_tick) => ({
          on_tick,
          strike: true,
          weapon_type: 'empty_handed',
          flat_damage: 100,
          can_critical_strike: false
        }))
      })
    ],
    [
      { type: 'cast', skillId: 1, interruptAfterMs: 5 },
      { type: 'cast', skillId: 1, interruptAfterMs: 5 }
    ],
    { 1: { interruptMode: 'per-packet' } }
  );
  assert.equal(result.totalDamage, 200);
  assert.equal(starts[1].timeMs - starts[0].timeMs, 16);
  assert.equal(result.skillStatus.player.Channel.ammo, 1);
});

test('shortened committed casts keep delayed packets at their original offsets', () => {
  const { result, starts } = adapt(
    [flatStrike('Delayed', 100, { cast_duration: [10, 10], strike_on_tick_list: [[20], [20]] })],
    [
      { type: 'cast', skillId: 1, interruptAfterMs: 3 },
      { type: 'cast', skillId: 1, interruptAfterMs: 1 }
    ],
    { 1: { interruptCommitMs: 2 } }
  );
  const damage = result.events.filter((event) => event.type === 'damage');
  assert.equal(damage.length, 1);
  assert.equal(damage[0].timeMs - starts[0].timeMs, 19);
});

test('permanent marker effects queue concurrent instant skills on the original actor at the relative offset', () => {
  const { starts, compiled } = adapt(
    [skill('Channel', { cast_duration: [20, 20] }), skill('Instant')],
    [
      { type: 'cast', skillId: 1 },
      { type: 'cast', skillId: 2, concurrentOffsetMs: 5 },
      { type: 'combat-start', concurrentOffsetMs: 3 }
    ]
  );
  assert.equal(starts[1].timeMs - starts[0].timeMs, 5);
  assert.equal(starts[2].timeMs - starts[1].timeMs, 3);
  assert.ok(starts.every((event) => event.actor === 'player'));
  assert.ok(compiled.build.permanent_unique_effects.some((effect) => effect.source_actor_skill_triggers));
});

test('recharge modifiers continue to affect both originals and variants', () => {
  const { starts } = adapt(
    [skill('Cast', { cooldown: [20, 20] })],
    [
      { type: 'cast', skillId: 1 },
      { type: 'wait', durationMs: 2 },
      { type: 'cast', skillId: 1 }
    ],
    {},
    {
      permanent_unique_effects: [
        {
          unique_effect_key: 'Refund',
          cooldown_modifiers: [
            {
              condition: { only_applies_on_finished_casting: true, only_applies_on_finished_casting_skill: 'Cast' },
              skill_key: 'Cast',
              operation: 'subtract',
              value: 10
            }
          ]
        }
      ]
    }
  );
  assert.equal(starts[2].timeMs - starts[0].timeMs, 10);
});
