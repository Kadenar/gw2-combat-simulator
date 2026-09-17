import assert from 'node:assert/strict';
import test from 'node:test';

import {
  readBuild,
  readRotationCsv,
  resolveUpstreamEncounter,
  withUpstreamSkillConventions
} from '#gw2/platform/combat-engine/configuration.js';
import { runCombatEngine } from '#gw2/platform/combat-engine/run.js';
import { encounter, flatStrike, skill } from '../../fixtures/combat-engine.js';

function failureOf(encounterConfiguration) {
  const result = runCombatEngine({ encounter: encounterConfiguration });
  assert.equal(result.ok, false);
  return result;
}

// Unsupported input is reported with its JSON path instead of silently becoming a default.
test('unknown keys and enum spellings fail with the responsible path', () => {
  const unknownKey = failureOf(encounter({ skills: [skill('Hit', { strike_on_tick: [[0], [0]] })] }));
  const unknownEffect = failureOf(
    encounter({
      skills: [
        skill('Hit', {
          on_pulse_effect_applications: [{ effect: 'BURN', direction: 'OUTGOING' }]
        })
      ]
    })
  );

  assert.deepEqual(
    [unknownKey.code, unknownKey.path],
    ['configuration.unsupported-key', 'encounter.actors[0].build.skills[0].strike_on_tick']
  );
  assert.deepEqual(
    [unknownEffect.code, unknownEffect.path],
    ['configuration.unknown-enum', 'encounter.actors[0].build.skills[0].on_pulse_effect_applications[0].effect']
  );
});

test('authoring notes are accepted but ambiguous or unrepresentable values are rejected', () => {
  const noted = runCombatEngine({
    encounter: encounter({ skills: [skill('Hit', { NOTE: 'comment' })], casts: ['Hit'] })
  });
  const fractional = failureOf(encounter({ skills: [skill('Hit', { cast_duration: [12.5, 10] })] }));
  const zeroAccelerated = failureOf(encounter({ skills: [skill('Hit', { cooldown: [1000, 0] })] }));
  const duplicateAttribute = failureOf(
    encounter({
      playerBuild: {
        attributes: [
          ['power', 1],
          ['power', 2]
        ]
      }
    })
  );

  assert.equal(noted.ok, true);
  assert.equal(fractional.code, 'configuration.expected-integer');
  assert.equal(zeroAccelerated.code, 'configuration.zero-accelerated-duration');
  assert.equal(duplicateAttribute.code, 'configuration.duplicate-attribute');
});

test('encounters must be bounded, uniquely named, and fully resolved', () => {
  const unbounded = failureOf(encounter({ terminationConditions: [] }));
  const duplicateNames = encounter();
  duplicateNames.actors[1].name = 'player';
  const unresolvedRecipe = failureOf(encounter({ playerBuild: { recipe_paths: ['recipes/food.json'] } }));

  assert.equal(unbounded.code, 'configuration.missing-termination');
  assert.equal(failureOf(duplicateNames).code, 'configuration.invalid-actor-name');
  assert.equal(unresolvedRecipe.code, 'configuration.unresolved-recipe-path');
});

test('skill ticks are ordered by tick while keeping authored order for ties', () => {
  const build = readBuild({
    skills: [
      skill('Channel', {
        skill_ticks: [
          { on_tick: 500, flat_damage: 1 },
          { on_tick: 0, flat_damage: 2 },
          { on_tick: 500, flat_damage: 3 }
        ]
      })
    ]
  });

  assert.deepEqual(
    build.skills[0].skillTicks.map((tick) => tick.flatDamage),
    [2, 1, 3]
  );
});

// The reference CLI floors seconds to whole milliseconds and rebases on the first row.
test('CSV rotations convert like the reference command line', () => {
  const rotation = readRotationCsv('rotation\r\nOpen, Time: 1.2345s\r\nFollow, Time: 2.0s\r\n');

  assert.deepEqual(
    rotation.skillCasts.map((cast) => [cast.skill, cast.castTimeMs]),
    [
      ['Open', 0],
      ['Follow', 766]
    ]
  );
});

test('file-based encounters resolve through an injected reader in reference order', () => {
  const files = {
    'build.json': JSON.stringify({
      skills: [flatStrike('Hit', 1)],
      recipes: [{ counters: [{ counter_key: 'Inline' }] }],
      recipe_paths: ['food.json']
    }),
    'food.json': JSON.stringify({ counters: [{ counter_key: 'File' }] }),
    'rotation.json': JSON.stringify({ skill_casts: [{ skill: 'Hit', cast_time_ms: 0 }], repeat: true }),
    'golem.json': JSON.stringify({ attributes: [['max_health', 100]] })
  };
  const resolved = resolveUpstreamEncounter(
    {
      actors: [
        { name: 'player', build_path: 'build.json', rotation_path: 'rotation.json', team: 1 },
        { name: 'golem', build_path: 'golem.json', team: 2 }
      ],
      termination_conditions: [{ type: 'ROTATION', actor: 'player' }]
    },
    (file) => files[file]
  );

  assert.deepEqual(
    resolved.actors[0].build.recipes.map((recipe) => recipe.counters[0].counter_key),
    ['Inline', 'File']
  );
  // The reference command line copies only the casts from a JSON rotation file.
  assert.equal(resolved.actors[0].rotation.repeat, false);
  assert.equal(runCombatEngine({ encounter: resolved }).ok, true);
});

// Upstream gives three skill names built-in behavior; the adapter turns them into explicit content flags.
test('upstream builds gain the flags their reference skill names imply, without overriding explicit content', () => {
  const adapted = readBuild(
    withUpstreamSkillConventions({
      skills: [skill('Weapon Swap'), skill('Lifesteal Proc'), skill('Other')],
      recipes: [{ skills: [skill('Weapon Swap', { weapon_swap: false })] }]
    })
  );
  const explicitCombo = readBuild(
    withUpstreamSkillConventions({ whirl_finisher_skills: [{ combo_field: 'ice', skill_key: 'Frost' }] })
  );

  assert.deepEqual(
    adapted.skills.map((entry) => [entry.skillKey, entry.weaponSwap, entry.skipOnStrikeHooks]),
    [
      ['Weapon Swap', true, false],
      ['Lifesteal Proc', false, true],
      ['Other', false, false]
    ]
  );
  assert.equal(adapted.recipes[0].skills[0].weaponSwap, false);
  assert.deepEqual(adapted.whirlFinisherSkills, [{ comboField: 'fire', skillKey: 'Burning Bolts' }]);
  assert.deepEqual(explicitCombo.whirlFinisherSkills, [{ comboField: 'ice', skillKey: 'Frost' }]);
});

test('a combo field may map to only one whirl finisher skill per actor', () => {
  const result = failureOf(
    encounter({
      playerBuild: {
        whirl_finisher_skills: [{ combo_field: 'fire', skill_key: 'A' }],
        recipes: [{ whirl_finisher_skills: [{ combo_field: 'fire', skill_key: 'B' }] }]
      }
    })
  );

  assert.equal(result.code, 'configuration.duplicate-whirl-finisher');
});
