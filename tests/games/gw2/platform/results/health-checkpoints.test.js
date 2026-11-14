/** Health milestones retain whole hits while final effective damage excludes overkill. */
import assert from 'node:assert/strict';
import test from 'node:test';

import { createHealthCheckpointRecorder } from '#gw2/platform/results/health-checkpoints.js';
import { observeGw2Runtime } from '#tests/helpers/observed-runtime.js';
import { defineTestProfession } from '#tests/helpers/profession.js';

test('milestones include whole crossing hits while final effective damage remains capped', () => {
  const recorder = createHealthCheckpointRecorder({ target: { health: 1000 } });
  recorder.observe(1, 100, 0);
  recorder.observe(2, 100, 150);
  recorder.observe(3, 1200, 150);
  recorder.observe(3, 1500, 250);
  const result = recorder.finish();
  assert.equal(result.effectiveDamage, 850);
  assert.deepEqual(
    result.checkpoints.map(({ healthPercent, at, playerDamage }) => [healthPercent, at, playerDamage]),
    [
      [80, 2, 100],
      [60, 3, 1500],
      [40, 3, 1500],
      [20, 3, 1500]
    ]
  );
  result.checkpoints[0].playerDamage = 999;
  assert.equal(recorder.finish().checkpoints[0].playerDamage, 100);
});

test('partial health and unfinished rotations expose only newly reached milestones', () => {
  const recorder = createHealthCheckpointRecorder({ target: { health: 1000, startingHealthFraction: 0.7 } });
  recorder.observe(4, 150, 0);
  assert.deepEqual(recorder.finish(), {
    effectiveDamage: 150,
    checkpoints: [{ healthPercent: 60, at: 4, playerDamage: 150 }]
  });
  assert.equal(createHealthCheckpointRecorder({}), null);
  assert.equal(createHealthCheckpointRecorder({ target: { health: 1000, fixedHealthFraction: 0.5 } }), null);
});

test('score and detailed output agree on credited damage for mixed strike, condition, and environment payouts', () => {
  const profession = defineTestProfession({ id: 'checkpoints', name: 'Checkpoints' }).runtimeFor({});
  const run = (output) =>
    observeGw2Runtime({
      profession,
      output,
      config: { target: { health: 1000, conditions: { Bleeding: 1 } } },
      rotation: [{ type: 'wait', durationMs: 5000 }],
      engineInitialize(runtime) {
        const source = { source: 'Fixture', sourceId: 'fixture', actorType: 'player' };
        runtime.effects.emit({ kind: 'packet', event: { ...source, at: 0.5, type: 'damage', flatDamage: 100 } });
        runtime.effects.emit({
          kind: 'packet',
          event: { ...source, at: 0.5, type: 'condition', condition: 'Burning', stacks: 10, duration: 4 }
        });
      }
    });
  const detailed = run('detailed');
  const score = run('score');
  assert.ok(detailed.totalDamage > detailed.effectiveDamage);
  assert.equal(score.effectiveDamage, detailed.effectiveDamage);
  assert.deepEqual(score.healthCheckpoints, detailed.healthCheckpoints);
  assert.equal(score.healthCheckpoints.at(-1).healthPercent, 20);
});
