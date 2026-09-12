import assert from 'node:assert/strict';
import test from 'node:test';
import {
  loadSimulationSettings,
  saveSimulationSettings,
  SIMULATION_SETTINGS_STORAGE_KEY
} from '#gw2/app/simulation/settings.js';
import { normalizeTransitionDelays } from '#gw2/platform/simulation/transition-delays.js';
import { createGw2SimulationConfig } from '#gw2/app/simulation/config.js';
import { mesmerAppAdapter } from '#gw2/professions/mesmer/app/app-definition.js';
import { createDefaultBuild, replaceBuildConfiguration } from '#gw2/app/build/state/persistence.js';
import {
  captureGearOptimizerRequest,
  createOptimizerEvaluator
} from '#gw2/app/simulation/gear-optimizer/gear-optimizer.js';

// Browser storage is separate from the build codec; missing or corrupt preferences remain safe.
test('simulation settings normalize invalid storage and persist separately from builds', (t) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value)
    }
  });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  });
  const zero = normalizeTransitionDelays(null);
  assert.deepEqual(loadSimulationSettings().transitionDelays, zero);
  values.set(SIMULATION_SETTINGS_STORAGE_KEY, '{broken');
  assert.deepEqual(loadSimulationSettings().transitionDelays, zero);
  assert.deepEqual(
    normalizeTransitionDelays({
      weaponSwapMs: -10,
      forgeEntryMs: Infinity,
      forgeExitMs: NaN,
      shroudEntryMs: '100',
      shroudExitMs: 170
    }),
    { ...zero, shroudExitMs: 170 }
  );
  saveSimulationSettings({ transitionDelays: { ...zero, weaponSwapMs: 100 } });
  assert.equal(loadSimulationSettings().transitionDelays.weaponSwapMs, 100);
  assert.deepEqual([...values.keys()], [SIMULATION_SETTINGS_STORAGE_KEY]);
});

test('simulation config snapshots preferences without adding them to imported or exported builds', () => {
  const build = createDefaultBuild(mesmerAppAdapter);
  const original = JSON.stringify(build);
  const app = {
    adapter: mesmerAppAdapter,
    build,
    skillById: mesmerAppAdapter.profession.catalog.skillsById,
    simulationSettings: { transitionDelays: normalizeTransitionDelays({ weaponSwapMs: 100 }) }
  };
  const config = createGw2SimulationConfig({
    app,
    attributeData: { attributes: {}, activeTraits: [] },
    specialization: 'Virtuoso'
  });
  app.simulationSettings.transitionDelays.weaponSwapMs = 200;
  assert.equal(config.transitionDelays.weaponSwapMs, 100);
  assert.equal(JSON.stringify(build), original);
  app.build = replaceBuildConfiguration(createDefaultBuild(mesmerAppAdapter), build, mesmerAppAdapter);
  assert.equal(app.simulationSettings.transitionDelays.weaponSwapMs, 200);
  assert.equal(JSON.stringify(app.build).includes('transitionDelays'), false);
});

test('optimizer workers retain a snapshot of simulation preferences outside the build', () => {
  const build = createDefaultBuild(mesmerAppAdapter);
  build.rotation = [{ type: 'cast', skillId: mesmerAppAdapter.profession.catalog.skillsByName.get('Swap Weapons').id }];
  const app = {
    adapter: mesmerAppAdapter,
    build,
    contentId: 'mesmer',
    patchId: 'current',
    buildRevision: 1,
    simulationSettings: { transitionDelays: normalizeTransitionDelays({ weaponSwapMs: 100 }) }
  };
  const request = captureGearOptimizerRequest(app, {});
  app.simulationSettings.transitionDelays.weaponSwapMs = 200;
  const result = createOptimizerEvaluator(request, mesmerAppAdapter).evaluate(request.build);
  const recovery = result.events.find((event) => event.type === 'gw2.transition-lockout');
  assert.equal(recovery.duration, 0.1);
  assert.equal(JSON.stringify(request.build).includes('transitionDelays'), false);
});
