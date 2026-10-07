import assert from 'node:assert/strict';
import test from 'node:test';
import {
  loadSimulationSettings,
  saveSimulationSettings,
  SIMULATION_SETTINGS_STORAGE_KEY
} from '#gw2/app/simulation/settings.js';
import { normalizeTransitionDelays, TRANSITION_DELAY_KEYS } from '#gw2/platform/execution/transition-lockouts.js';
import { createGw2SimulationConfig } from '#gw2/app/simulation/build-config.js';
import { mesmerAppAdapter } from '#gw2/professions/mesmer/app/app-definition.js';
import { createDefaultBuild, replaceBuildConfiguration } from '#gw2/app/build/state/persistence.js';
import { captureGearOptimizerRequest, createOptimizerEvaluator } from '#gw2/app/optimizer/gear/search.js';
import { ProfessionApp } from '#gw2/app/profession-app.js';
import { createBuildTab, emptyBuildTabSession } from '#gw2/app/build/state/workspace.js';
import { mountSimulationSettings } from '#gw2/app/build/panels/simulation-settings.js';
import { BaselineSimulationRunner } from '#gw2/app/simulation/baseline/runner.js';
import { beginRotationComparison, setRotationReference } from '#gw2/app/rotation/comparison-state.js';

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

function stubGlobal(t, name, value) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, name, previous);
    else delete globalThis[name];
  });
}

// Keep rendering inert while exercising real settings callbacks, app revisions, scheduling, and cache admission.
function settingsWorkspace(t, initialDelay = 0) {
  const values = new Map();
  stubGlobal(t, 'localStorage', {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  });
  stubGlobal(t, 'document', {
    body: {
      dataset: {},
      removeAttribute() {},
      classList: { remove() {}, contains: () => false }
    },
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => []
  });
  stubGlobal(t, 'HTMLButtonElement', class {});
  const adapter = { ...mesmerAppAdapter, renderRotationBuilder() {} };
  const build = createDefaultBuild(adapter);
  build.rotation = [{ type: 'combat-start' }, { type: 'cast', skillId: -3 }, { type: 'cast', skillId: 73154 }];
  const tab = createBuildTab(build, 'A');
  const app = Object.assign(Object.create(ProfessionApp.prototype), emptyBuildTabSession(), {
    adapter,
    profession: adapter.profession,
    activeCatalog: adapter.profession.catalog,
    skillById: adapter.profession.catalog.skillsById,
    workspace: { tabs: [tab], activeTabId: tab.id },
    build,
    patchId: 'current',
    buildRevision: 1,
    resultRevision: -1,
    simulationStatus: 'queued',
    initialRenderGeneration: 0,
    simulationSettings: {
      transitionDelays: Object.fromEntries(TRANSITION_DELAY_KEYS.map((key) => [key, initialDelay]))
    },
    randomDistributionRunner: { cancel() {}, schedule() {} },
    modifierContributionRunner: { cancel() {}, schedule() {} },
    relicComparisonRunner: { cancel() {}, schedule() {} },
    renderBuildSections() {}
  });
  app.baselineSimulationRunner = new BaselineSimulationRunner(app);
  t.after(() => app.baselineSimulationRunner.cancel());
  const settle = () => {
    app.baselineSimulationRunner.cancel();
    app.commitBaselineSimulation(
      adapter.calculateBaselineSimulation(adapter.baselineSimulationRequest(app)),
      app.buildRevision,
      false
    );
  };

  const pin = () => {
    assert.equal(beginRotationComparison(app), true);
    assert.equal(setRotationReference(app, app.build.rotation), true);
    settle();
  };

  adapter.recalculate(app);
  settle();
  pin();
  const cached = app.results;
  const reference = app.rotationComparison.referenceResult;
  const other = createBuildTab(structuredClone(build), 'B');
  app.workspace.tabs.push(other);
  app.activateBuildTab(other.id);
  settle();
  pin();

  const controls = [];
  const element = () => {
    const node = {
      handlers: {},
      append() {},
      querySelector: () => null,
      setAttribute() {},
      addEventListener(event, callback) {
        this.handlers[event] = callback;
      },
      createTBody: element,
      insertRow: element,
      insertCell: element
    };
    controls.push(node);
    return node;
  };

  const container = element();
  mountSimulationSettings(app, { getElementById: () => container, createElement: element });
  const input = (key, value) => {
    const node = controls.find((control) => control.id === `simulation-${key}`);
    node.value = String(value);
    node.handlers.change();
    assert.equal(node.value, String(app.simulationSettings.transitionDelays[key]));
  };

  const click = (label) => controls.find((control) => control.textContent === label).handlers.click();
  return { app, tab, cached, reference, settle, input, click };
}

// Every shared field and both bulk actions invalidate Current and Reference without eagerly running inactive tabs.
for (const action of [...TRANSITION_DELAY_KEYS, 'Apply 100 ms to all', 'Clear all']) {
  test(`shared transition settings refresh inactive Current and Reference: ${action}`, (t) => {
    const { app, tab, cached, reference, settle, input, click } = settingsWorkspace(
      t,
      action === 'Clear all' ? 100 : 0
    );
    if (TRANSITION_DELAY_KEYS.includes(action)) input(action, 1000);
    else click(action);
    const delays = app.simulationSettings.transitionDelays;
    assert.deepEqual(loadSimulationSettings().transitionDelays, delays);
    assert.equal(tab.resultsFresh, false);
    assert.equal(tab.session.rotationComparison.referenceStatus, 'queued');
    assert.equal(app.rotationComparison.referenceStatus, 'queued');
    assert.equal(app.baselineSimulationRunner.pending.revision, app.buildRevision);
    assert.equal(tab.session.results, cached);
    assert.equal(tab.session.rotationComparison.referenceResult, reference);

    app.activateBuildTab(tab.id);
    assert.equal(app.results, null);
    assert.equal(app.simulationStatus, 'queued');
    const request = app.baselineSimulationRunner.pending.request;
    assert.deepEqual(request.baseConfig.transitionDelays, delays);
    assert.deepEqual(request.referenceRotation, app.rotationComparison.referenceRotation);
    settle();
    assert.notEqual(app.results, cached);
    assert.notEqual(app.rotationComparison.referenceResult, reference);
    assert.equal(app.rotationComparison.referenceStatus, 'fresh');
    assert.equal(app.resultRevision, app.buildRevision);
    assert.equal(app.simulationStatus, 'idle');
  });
}

test('unchanged normalized delays and rotation-only edits preserve inactive caches', (t) => {
  const { app, tab, cached, reference, input, click } = settingsWorkspace(t);
  const revision = app.buildRevision;
  input('weaponSwapMs', 0);
  input('weaponSwapMs', -100);
  input('weaponSwapMs', 'invalid');
  click('Clear all');
  assert.equal(app.buildRevision, revision);
  assert.equal(app.baselineSimulationRunner.pending, null);
  app.build.rotation.push({ type: 'wait', durationMs: 100 });
  app.changed(false);
  assert.equal(tab.resultsFresh, true);
  assert.equal(app.rotationComparison.referenceStatus, 'fresh');
  app.activateBuildTab(tab.id);
  assert.equal(app.results, cached);
  assert.equal(app.rotationComparison.referenceResult, reference);
  assert.equal(app.rotationComparison.referenceStatus, 'fresh');
  assert.equal(app.baselineSimulationRunner.pending, null);
});

test('reverting shared delays still refreshes invalidated tabs and leaves empty references empty', (t) => {
  const { app, tab, input, settle } = settingsWorkspace(t);
  const empty = createBuildTab(structuredClone(app.build), 'Empty reference');
  empty.session.rotationComparison = {
    referenceRotation: [],
    referenceResult: null,
    referenceStatus: 'empty',
    referenceError: ''
  };
  app.workspace.tabs.push(empty);
  input('weaponSwapMs', 1000);
  input('weaponSwapMs', 0);
  assert.equal(tab.resultsFresh, false);
  assert.equal(empty.session.rotationComparison.referenceStatus, 'empty');
  app.activateBuildTab(tab.id);
  assert.equal(app.baselineSimulationRunner.pending.request.baseConfig.transitionDelays.weaponSwapMs, 0);
  assert.ok(app.baselineSimulationRunner.pending.request.referenceRotation);
  settle();
  assert.equal(app.rotationComparison.referenceStatus, 'fresh');
});
