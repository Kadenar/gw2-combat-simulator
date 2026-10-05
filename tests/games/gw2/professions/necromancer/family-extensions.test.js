import assert from 'node:assert/strict';
import test from 'node:test';
import { runGw2Runtime } from '#gw2/platform/simulation/runtime.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import { registerNecromancerShroudLifecycle } from '#gw2/professions/necromancer/core/mechanics/shroud-lifecycle.js';
import {
  registerCreatureSummonReaction,
  runCreatureSummonReactions,
  registerNecromancerCreatureStrikeMultiplier,
  necromancerCreatureStrikeMultiplier
} from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';

/** Capture author runtime owners after the selected modules register their own callbacks. */
function run(specialization, rotation, initialize) {
  const config = {
    specialization,
    initialResource: 50,
    stats: { power: 1000, precision: 1000, vitality: 1000 },
    target: { armor: 2597 }
  };
  const profession = necromancerProfession.runtimeFor(config);
  return runGw2Runtime({
    profession: {
      ...profession,
      initialize(runtime) {
        profession.initialize?.(runtime);
        initialize(runtime);
      }
    },
    config,
    rotation
  });
}

test('shroud observers see committed Core transitions and remain isolated across selected elites and runs', () => {
  const traces = [];
  for (const [specialization, entryId] of [
    ['Harbinger', ID.HARBINGER_SHROUD],
    ['Ritualist', ID.RITUALISTS_SHROUD],
    ['Core', ID.DEATH_SHROUD],
    ['Harbinger', ID.HARBINGER_SHROUD]
  ]) {
    // Use the selected form's entry/exit pair; Core entries remain present in elite catalogs.
    const catalog = necromancerProfession.runtimeFor({ specialization }).catalog;
    const entry = catalog.skillsById.get(entryId);
    const exit = catalog.skills.find((skill) => skill.shroudExit === entry.shroudEntry);
    const trace = [];
    traces.push(trace);
    const result = run(
      specialization,
      [
        { type: 'cast', skillId: entry.id },
        { type: 'cast', skillId: exit.id }
      ],
      (runtime) => {
        registerNecromancerShroudLifecycle(runtime, 'test.transitions', {
          onEnter(skill) {
            assert.equal(runtime.profession.specialization.kind, specialization);
            assert.equal(runtime.profession.core.activeShroud, skill.shroudEntry);
            if (specialization === 'Harbinger') {
              assert.ok(Number.isFinite(runtime.profession.specialization.state.nextBlightAt));
            }

            trace.push('enter');
          },
          onExit() {
            assert.equal(runtime.profession.core.activeShroud, '');
            if (specialization === 'Harbinger') {
              assert.equal(runtime.profession.specialization.state.nextBlightAt, Infinity);
            }

            trace.push('exit');
          }
        });
      }
    );
    assert.deepEqual(result.warnings, []);
    for (const previous of traces) assert.deepEqual(previous, ['enter', 'exit']);
  }
});

test('creature subscriptions and multiplier replacements affect only their owning run', () => {
  const owners = [];
  for (let index = 0; index < 2; index++) {
    run('Core', [], (runtime) => owners.push(runtime));
  }

  const [first, second] = owners;
  const summons = [];
  registerCreatureSummonReaction(first, 'test.summon', (skill, at, count, activationId) => {
    summons.push({ skillId: skill.id, at, count, activationId });
  });
  registerNecromancerCreatureStrikeMultiplier(first, 'test.multiplier', () => 2);
  registerNecromancerCreatureStrikeMultiplier(second, 'test.multiplier', () => 3);
  const skill = necromancerProfession.catalog.skillsByName.get('Summon Blood Fiend');
  runCreatureSummonReactions(second, skill, 1, 1, 'other-run');
  assert.deepEqual(summons, []);
  runCreatureSummonReactions(first, skill, 2, 1, 'first-run');
  assert.deepEqual(summons, [{ skillId: skill.id, at: 2, count: 1, activationId: 'first-run' }]);
  assert.equal(necromancerCreatureStrikeMultiplier(first), 2);
  assert.equal(necromancerCreatureStrikeMultiplier(second), 3);
  registerNecromancerCreatureStrikeMultiplier(first, 'test.multiplier', () => 0);
  assert.equal(necromancerCreatureStrikeMultiplier(first), 0);
  assert.equal(necromancerCreatureStrikeMultiplier(second), 3);
});
