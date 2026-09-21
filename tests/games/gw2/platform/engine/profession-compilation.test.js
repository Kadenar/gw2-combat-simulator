import assert from 'node:assert/strict';
import test from 'node:test';
import { defineNativeModule, defineNativeProfession } from '#gw2/platform/profession-definition/profession.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';

// Compiling and running a headless family must never evaluate application presentation factories.
test('native runtime compilation defers presentation until the application requests it', () => {
  let presentations = 0;
  const profession = defineNativeProfession({
    id: 'headless',
    name: 'Headless',
    modules: [
      defineNativeModule({
        id: 'Core',
        data: {},
        state: { scheduler: () => ({}) },
        presentation() {
          presentations += 1;
          return { resourceViews: () => [{ id: 'resource', maximum: 3, value: 1 }] };
        }
      })
    ]
  });
  const runtime = profession.resolveRuntime({});
  assert.equal(Object.hasOwn(runtime, 'ui'), false);
  assert.equal(Object.hasOwn(runtime, 'migrateBuild'), false);
  assert.deepEqual(simulateGw2({ profession: runtime, rotation: [] }).warnings, []);
  assert.deepEqual(simulateGw2({ profession, rotation: [] }).warnings, []);
  assert.equal(presentations, 0);
  const ui = profession.ui;
  assert.equal(presentations, 1);
  assert.equal(profession.ui, ui);
  assert.equal(ui.resourceViews({}).length, 1);
  assert.equal(profession.resolveRuntime({}), runtime);
});
