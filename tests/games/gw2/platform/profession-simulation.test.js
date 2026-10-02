import assert from 'node:assert/strict';
import test from 'node:test';
import { defineNativeModule, defineNativeProfession } from '#gw2/platform/profession-definition/profession.js';
import { createProfessionSimulator } from '#tests/helpers/profession-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';

// A minimal native owner isolates fixture setup and queue ordering from authored profession behavior.
function fixtureProfession() {
  return defineNativeProfession({
    id: 'fixture',
    name: 'Fixture',
    modules: [
      defineNativeModule({
        id: 'Core',
        data: {},
        state: { create: () => ({ calls: [] }) },
        hooks: {
          initialize: (runtime) => runtime.profession.core.calls.push('native'),
          tasks: {
            'fixture.work': (runtime) => runtime.profession.core.calls.push('work')
          }
        }
      })
    ]
  });
}

test('shared scenarios initialize native state before fixtures and preserve queued observation order', () => {
  const run = createProfessionSimulator(fixtureProfession());
  for (const output of ['detailed', 'score']) {
    const result = run(
      [],
      {},
      {
        output,
        observation: { kind: 'tail', durationMs: 1000 },
        extend: (native) => ({
          tasks: {
            ...native.tasks,
            'fixture.extension': (runtime) => runtime.profession.core.calls.push('extension')
          }
        }),
        initialize(runtime) {
          assert.deepEqual(runtime.profession.core.calls, ['native']);
          runtime.profession.core.calls.push('fixture');
          runtime.schedule('fixture.work', 1);
          runtime.schedule('fixture.extension', 1);
        },
        timeline: [
          { at: 1, priority: -1, run: (runtime) => runtime.profession.core.calls.push('early') },
          { at: 1.000001, run: () => assert.fail('Work beyond the observation window must not execute.') }
        ],
        probes: [[1, (runtime) => runtime.profession.core.calls.push('probe')]]
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.equal(result.rotationEndTime, 0);
    assert.equal(result.observationEndTime, 1);
    assert.deepEqual(observedRuntime(result).profession.core.calls, [
      'native',
      'fixture',
      'early',
      'work',
      'extension',
      'probe'
    ]);
  }
});

test('shared scenarios isolate defaults and catalog overrides between native runtime selections', () => {
  const profession = fixtureProfession();
  const run = createProfessionSimulator(profession, () => ({
    selectedTraitIds: [],
    target: { armor: 2597, conditions: { Burning: true } }
  }));
  const native = profession.runtimeFor({});
  const catalog = { ...native.catalog, skillsById: new Map(native.catalog.skillsById) };
  const first = observedRuntime(
    run(
      [],
      { target: { armor: 1000 } },
      {
        catalog: () => catalog,
        initialize(runtime) {
          runtime.config.selectedTraitIds.push(123);
          runtime.schedule('fixture.work', 0);
        }
      }
    )
  );
  const second = observedRuntime(run([]));
  assert.equal(first.helpers.skillsById, catalog.skillsById);
  assert.equal(second.helpers.skillsById, native.catalog.skillsById);
  assert.deepEqual(second.config.selectedTraitIds, []);
  assert.equal(first.config.target.conditions?.Burning, undefined);
  assert.equal(second.config.target.conditions.Burning, true);
  assert.deepEqual(first.profession.core.calls, ['native', 'work']);
  assert.deepEqual(second.profession.core.calls, ['native']);
});
