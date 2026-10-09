import assert from 'node:assert/strict';
import test from 'node:test';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { alliedAshes } from '#gw2/professions/guardian/specializations/firebrand/mechanics/effects.js';
import { observeGw2Runtime } from '#tests/helpers/observed-runtime.js';

// A Quickfire-sized grant isolates allied charge retention from the player's tome and strike activity.
function run({ duration = 5, combatStartTime = 3, output, secondGrantAt } = {}) {
  const config = { specialization: 'Firebrand', allies: { count: 2, strikesPerSecond: 2 } };
  const native = guardianProfession.runtimeFor(config);
  const grant = (runtime) =>
    alliedAshes(
      runtime,
      {
        type: 'buff',
        at: runtime.time,
        source: 'test',
        sourceId: 'test.ashes',
        actorType: 'player',
        activationId: `grant:${runtime.time}`,
        skillName: 'Quickfire'
      },
      1,
      duration,
      { maximumAllies: 1, priority: 0, skillName: 'Quickfire', name: 'Ashes of the Just' }
    );
  return observeGw2Runtime({
    config,
    combatStartTime,
    output,
    rotation: [{ type: 'wait', durationMs: 6000 }],
    profession: {
      ...native,
      initialize(runtime) {
        native.initialize?.(runtime);
        grant(runtime);
        if (secondGrantAt != null) runtime.schedule('test.grant', secondGrantAt);
      },
      tasks: { ...native.tasks, 'test.grant': grant }
    }
  });
}

const burns = (result) =>
  result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.sourceId === 'guardian.ashes-of-the-just'
  );

test('precast Ashes retains its charge for the first eligible allied strike and keeps recipient attribution', () => {
  const result = run();
  assert.deepEqual(
    burns(result).map(({ at, metadata }) => [at, metadata.triggeredByAlly]),
    [[3.5, 1]]
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(run({ output: 'score' }).totalDamage, result.totalDamage);
  assert.deepEqual(burns(run({ duration: 2 })), []);
});

test('later Ashes grants share the existing cadence and recipient cooldown', () => {
  const result = run({ combatStartTime: 0, secondGrantAt: 0.8 });
  // The second grant must wait for the recipient ICD while retaining the original half-second strike grid.
  assert.deepEqual(
    burns(result).map(({ at }) => at),
    [0.5, 1.5]
  );
});
