import assert from 'node:assert/strict';
import test from 'node:test';
import { adaptRotation } from '#gw2/platform/simulation/combat-engine-adapter/rotation.js';
import { runCombatPrefix } from '#gw2/platform/simulation/combat-engine-adapter/prefix.js';
import { runCombatEngine } from '#gw2/platform/combat-engine/run.js';
import { encounter, flatStrike, skill } from '../fixtures/combat-engine.js';

// Replay small command prefixes and compare the adapter's state to the engine's own terminal queries.
function project(skills, rotation, insertionIndex, playerBuild = {}) {
  const input = encounter({ skills, playerBuild, require_afk_skills: false });
  const keys = new Map(skills.map((entry, index) => [index + 1, entry.skill_key]));
  const catalog = new Map(skills.map((entry, index) => [index + 1, { id: index + 1, name: entry.skill_key }]));
  const compiled = adaptRotation(input.actors[0].build, rotation.slice(0, insertionIndex), keys, catalog, false);
  input.actors[0].build = compiled.build;
  input.actors[0].rotation = compiled.rotation;
  const request = { ...compiled, encounter: input };
  const outcome = runCombatPrefix(request, insertionIndex);
  assert.equal(outcome.ok, true, outcome.message);
  const direct = runCombatEngine(request);
  assert.equal(direct.ok, true, direct.message);
  assert.equal(outcome.state.time, direct.endTick);
  for (const [id, key] of keys) assert.deepEqual(outcome.state.availability[id], direct.skillStatus.player[key]);
  return { state: outcome.state, request };
}

test('beginning, middle and append preserve ammo and cooldown state without draining delayed actions', () => {
  const skills = [
    skill('Charge', { cast_duration: [5, 5], ammo: 2, cooldown: [30, 30], skill_ticks: [{ on_tick: 20, pulse: true }] })
  ];
  const rotation = [
    { type: 'cast', skillId: 1 },
    { type: 'cast', skillId: 1 }
  ];
  const beginning = project(skills, rotation, 0).state;
  assert.equal(beginning.time, 0);
  assert.equal(beginning.ammoBySkillId[1].charges, 2);
  assert.deepEqual(beginning.counters, {});
  const middle = project(skills, rotation, 1).state;
  assert.equal(middle.time, 5);
  assert.equal(middle.ammoBySkillId[1].charges, 1);
  assert.equal(middle.availability[1].isAvailableToCast, true);
  const end = project(skills, rotation, 2).state;
  assert.equal(end.time, 10);
  assert.equal(end.ammoBySkillId[1].charges, 0);
  assert.equal(end.availability[1].isAvailableToCast, false);
  assert.match(end.availability[1].unavailableToCastReason, /ammo/);
  assert.ok(end.cooldownsBySkillId[1].remaining > 0);
});

test('cast completion equipment and counters settle at the boundary; later pulses do not', () => {
  const skills = [
    skill('Prepare', {
      cast_duration: [5, 5],
      equip_bundle: 'Kit',
      tags: ['BUILDER'],
      skill_ticks: [
        {
          on_tick: 12,
          pulse: true,
          on_pulse_effect_applications: [{ direction: 'SELF', effect: 'MIGHT', base_duration_ms: 100 }]
        }
      ]
    }),
    skill('Conditional', { required_bundle: 'Kit', cast_condition: { effect_on_source: 'MIGHT' } }),
    skill('Swap', { weapon_swap: true, cast_duration: [2, 2], cooldown: [100, 100] }),
    skill('Sword', { weapon_type: 'sword' })
  ];
  const build = {
    counters: [{ counter_key: 'Charges' }],
    weapons: [
      { type: 'pistol', position: 'main_hand', set: 'set_1' },
      { type: 'sword', position: 'main_hand', set: 'set_2' }
    ],
    permanent_unique_effects: [
      {
        unique_effect_key: 'Count',
        counter_modifiers: [
          {
            condition: {
              only_applies_on_finished_casting_skill_with_tag: 'BUILDER',
              only_applies_on_finished_casting: true
            },
            counter_key: 'Charges',
            operation: 'add',
            value: 1
          }
        ]
      }
    ]
  };
  const rotation = [
    { type: 'cast', skillId: 1 },
    { type: 'wait', durationMs: 20 }
  ];
  const middle = project(skills, rotation, 1, build).state;
  assert.equal(middle.time, 5);
  assert.equal(middle.bundle, 'Kit');
  assert.equal(middle.counters.Charges, 1);
  assert.equal(middle.availability[2].isAvailableToCast, false);
  const end = project(skills, rotation, 2, build).state;
  assert.equal(end.availability[2].isAvailableToCast, true);
  assert.equal(end.counters.Charges, 1);
  const before = project(skills, [{ type: 'cast', skillId: 3 }], 0, build).state;
  const after = project(skills, [{ type: 'cast', skillId: 3 }], 1, build).state;
  assert.equal(before.activeWeaponSet, 1);
  assert.equal(before.availability[4].isAvailableToCast, false);
  assert.equal(after.activeWeaponSet, 2);
  assert.equal(after.availability[4].isAvailableToCast, true);
  const bundled = project(
    skills,
    [
      { type: 'cast', skillId: 3 },
      { type: 'cast', skillId: 1 }
    ],
    2,
    build
  ).state;
  assert.equal(bundled.ammoBySkillId[3].charges, 0);
  assert.ok(bundled.cooldownsBySkillId[3].remaining > 0);
  assert.equal(bundled.availability[3].isAvailableToCast, true);
});

test('prefix failures cannot publish partial state and retain engine work-limit diagnostics', () => {
  const { request } = project([skill('Cast', { cast_duration: [5, 5] })], [{ type: 'cast', skillId: 1 }], 1);
  const outcome = runCombatPrefix({ ...request, tickLimit: 2 }, 1);
  assert.equal(outcome.ok, false);
  assert.equal(outcome.code, 'loop.tick-limit');
  assert.equal(outcome.tick, 2);
  assert.equal(outcome.state, undefined);
});

test('a target death before the requested cursor fails without labeling partial state as append', () => {
  const input = encounter({
    skills: [flatStrike('Kill', 2_000_000_000), skill('Wait', { cast_duration: [5, 5] })],
    casts: ['Kill', 'Wait']
  });
  const outcome = runCombatPrefix({ encounter: input, damageSources: {}, commandSkills: [] }, 2);
  assert.equal(outcome.ok, false);
  assert.equal(outcome.code, 'preview.prefix-ended-by-death');
  assert.equal(outcome.state, undefined);
});
