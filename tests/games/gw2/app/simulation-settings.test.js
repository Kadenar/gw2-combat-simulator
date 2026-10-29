import assert from 'node:assert/strict';
import test from 'node:test';

import { createScenarioEditor } from '#gw2/app/boss-scenarios/editor.js';
import { createBossScenario, parseBossScenario } from '#gw2/app/boss-scenarios/model.js';
import {
  normalizeTargetArmor,
  PRIMARY_ATTRIBUTES,
  STACKING_TARGET_CONDITIONS,
  TARGET_ARMOR_OPTIONS,
  TARGET_CONDITION_GROUPS
} from '#gw2/app/build/panels/metadata.js';
import { mountSimulationSettings } from '#gw2/app/build/panels/simulation-settings.js';
import { createDefaultBuild, replaceBuildConfiguration } from '#gw2/app/build/state/persistence.js';
import { createBuildTab, emptyBuildTabSession } from '#gw2/app/build/state/workspace.js';
import { applyBuildFileImport, previewBuildFileImport } from '#gw2/app/import-export/build-file-import.js';
import { getBuildWithRotationExportPayload } from '#gw2/app/import-export/files.js';
import { captureGearOptimizerRequest, createOptimizerEvaluator } from '#gw2/app/optimizer/gear/search.js';
import { ProfessionApp } from '#gw2/app/profession-app.js';
import { beginRotationComparison, setRotationReference } from '#gw2/app/rotation/comparison-state.js';
import { BaselineSimulationRunner } from '#gw2/app/simulation/baseline/runner.js';
import {
  loadSimulationSettings,
  saveSimulationSettings,
  SIMULATION_SETTINGS_STORAGE_KEY
} from '#gw2/app/simulation/settings.js';
import { STANDARD_TARGET_ARMOR } from '#gw2/platform/combat/formulas.js';
import { normalizeTransitionDelays, TRANSITION_DELAY_KEYS } from '#gw2/platform/execution/transition-lockouts.js';
import { mesmerAppAdapter } from '#gw2/professions/mesmer/app/app-definition.js';
import { createMesmerBuildDefaults } from '#gw2/professions/mesmer/build/build.js';

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
    patch: mesmerAppAdapter.profession.resolvePatch(),
    adapter: mesmerAppAdapter,
    build,
    activeCatalog: mesmerAppAdapter.profession.catalog,
    simulationSettings: { transitionDelays: normalizeTransitionDelays({ weaponSwapMs: 100 }) }
  };
  const config = mesmerAppAdapter
    .createBuildContext({
      build,
      transitionDelays: app.simulationSettings.transitionDelays,
      patch: mesmerAppAdapter.profession.resolvePatch({ id: 'current' })
    })
    .simulationConfig();
  app.simulationSettings.transitionDelays.weaponSwapMs = 200;
  assert.equal(config.transitionDelays.weaponSwapMs, 100);
  assert.equal(JSON.stringify(build), original);
  app.build = replaceBuildConfiguration(createDefaultBuild(mesmerAppAdapter), build, mesmerAppAdapter);
  assert.equal(app.simulationSettings.transitionDelays.weaponSwapMs, 200);
  assert.equal(JSON.stringify(app.build).includes('transitionDelays'), false);
});

test('optimizer workers retain a snapshot of simulation preferences outside the build', () => {
  const build = createDefaultBuild(mesmerAppAdapter);
  build.rotation = [{ type: 'cast', skillId: mesmerAppAdapter.profession.catalog.skillsById.get(-3).id }];
  const app = {
    adapter: mesmerAppAdapter,
    build,
    contentId: 'mesmer',
    patch: mesmerAppAdapter.profession.resolvePatch({ id: 'current' }),
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
    dispatchEvent() {},
    querySelector: () => null,
    querySelectorAll: () => []
  });
  stubGlobal(t, 'HTMLButtonElement', class {});
  const adapter = { ...mesmerAppAdapter, renderRotationBuilder() {} };
  const build = createDefaultBuild(adapter);
  build.rotation = [{ type: 'combat-start' }, { type: 'cast', skillId: -3 }, { type: 'cast', skillId: 73154 }];
  const tab = createBuildTab(build, 'A');
  const simulationSettings = {
    transitionDelays: Object.fromEntries(TRANSITION_DELAY_KEYS.map((key) => [key, initialDelay]))
  };
  const app = Object.assign(Object.create(ProfessionApp.prototype), emptyBuildTabSession(), {
    adapter,
    profession: adapter.profession,
    workspace: { tabs: [tab], activeTabId: tab.id, simulationSettings },
    build,
    patch: adapter.profession.resolvePatch({ id: 'current' }),
    buildRevision: 1,
    resultRevision: -1,
    simulationStatus: 'queued',
    initialRenderGeneration: 0,
    simulationSettings,
    randomDistributionRunner: { cancel() {}, schedule() {} },
    modifierContributionRunner: { cancel() {}, schedule() {} },
    relicComparisonRunner: { schedule() {} },
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

  app.attributeData = adapter
    .createBuildContext({
      build: app.build,
      transitionDelays: normalizeTransitionDelays(app.simulationSettings?.transitionDelays),
      patch: adapter.profession.resolvePatch({ id: app.patch.id ?? 'current' })
    })
    .attributes(app.attributeWeaponSet === 2 ? 2 : 1);
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
  const remount = () => {
    controls.length = 0;
    mountSimulationSettings(app, { getElementById: () => container, createElement: element });
  };

  remount();
  const input = (key, value) => {
    const node = controls.find((control) => control.id === `simulation-${key}`);
    node.value = String(value);
    node.handlers.change();
    assert.equal(node.value, String(app.simulationSettings.transitionDelays[key]));
  };

  const click = (label) => controls.find((control) => control.textContent === label).handlers.click();
  return { app, tab, cached, reference, settle, input, click, remount };
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
    assert.equal(app.baselineSimulationRunner.queue.pending.revision, app.buildRevision);
    assert.equal(tab.session.results, cached);
    assert.equal(tab.session.rotationComparison.referenceResult, null);

    app.activateBuildTab(tab.id);
    assert.equal(app.results, null);
    assert.equal(app.simulationStatus, 'queued');
    const request = app.baselineSimulationRunner.queue.pending.request;
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

// Importing settings follows the same shared-cache and persistence contract as editing the workspace controls.
test('accepted rotation delay metadata persists workspace settings and invalidates inactive comparison results', (t) => {
  const { app, tab, settle } = settingsWorkspace(t);
  const delays = normalizeTransitionDelays({ weaponSwapMs: 150 });
  const preview = previewBuildFileImport(getBuildWithRotationExportPayload(app.build, delays), 'build.json', app);
  assert.equal(tab.resultsFresh, true);
  assert.equal(app.simulationSettings.transitionDelays.weaponSwapMs, 0);
  applyBuildFileImport(app, preview, { build: true, rotation: true });
  assert.deepEqual(loadSimulationSettings().transitionDelays, delays);
  assert.equal(tab.resultsFresh, false);
  assert.equal(tab.session.rotationComparison.referenceStatus, 'queued');
  app.activateBuildTab(tab.id);
  assert.deepEqual(app.simulationSettings.transitionDelays, delays);
  assert.deepEqual(app.baselineSimulationRunner.queue.pending.request.baseConfig.transitionDelays, delays);
  settle();
  assert.equal(app.rotationComparison.referenceStatus, 'fresh');
});

test('unchanged normalized delays and rotation-only edits preserve inactive caches', (t) => {
  const { app, tab, cached, reference, input, click } = settingsWorkspace(t);
  const revision = app.buildRevision;
  input('weaponSwapMs', 0);
  input('weaponSwapMs', -100);
  input('weaponSwapMs', 'invalid');
  click('Clear all');
  assert.equal(app.buildRevision, revision);
  assert.equal(app.baselineSimulationRunner.queue.pending, null);
  app.build.rotation.push({ type: 'wait', durationMs: 100 });
  app.changed(false);
  assert.equal(tab.resultsFresh, true);
  assert.equal(app.rotationComparison.referenceStatus, 'fresh');
  app.activateBuildTab(tab.id);
  assert.equal(app.results, cached);
  assert.equal(app.rotationComparison.referenceResult, reference);
  assert.equal(app.rotationComparison.referenceStatus, 'fresh');
  assert.equal(app.baselineSimulationRunner.queue.pending, null);
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
  assert.equal(app.baselineSimulationRunner.queue.pending.request.baseConfig.transitionDelays.weaponSwapMs, 0);
  assert.ok(app.baselineSimulationRunner.queue.pending.request.referenceRotation);
  settle();
  assert.equal(app.rotationComparison.referenceStatus, 'fresh');
});

// Cached results stay valid when returning to an unchanged workspace with its own simulation inputs.
test('Golem and separate boss scenarios retain independent delays, caches, and saved settings', (t) => {
  const { app, tab, input, settle, remount } = settingsWorkspace(t, 100);
  const golem = app.workspace;
  const golemResult = app.results;
  const first = createBossScenario('020102', app.build, 'First boss', 'current');
  const second = createBossScenario('020506', app.build, 'Second boss', 'current');
  const editor = createScenarioEditor(app, () => {}, { import() {}, export() {} });
  editor.open(first);
  settle();
  remount();
  assert.equal(app.rotationComparison, null);
  assert.equal(app.simulationSettings.transitionDelays.weaponSwapMs, 0);
  input('weaponSwapMs', 250);
  settle();
  const firstResult = app.results;
  assert.equal(first.simulationSettings.transitionDelays.weaponSwapMs, 250);
  assert.equal(loadSimulationSettings().transitionDelays.weaponSwapMs, 0);
  assert.equal(tab.resultsFresh, true);

  editor.open(second);
  settle();
  remount();
  assert.equal(app.simulationSettings.transitionDelays.weaponSwapMs, 0);
  input('weaponSwapMs', 500);
  settle();
  editor.close();
  remount();
  assert.equal(app.workspace, golem);
  assert.equal(app.results, golemResult);
  assert.equal(app.simulationSettings.transitionDelays.weaponSwapMs, 100);
  input('weaponSwapMs', 150);
  settle();
  assert.equal(loadSimulationSettings().transitionDelays.weaponSwapMs, 150);

  editor.open(first);
  assert.equal(app.results, firstResult);
  assert.equal(app.baselineSimulationRunner.queue.pending, null);
  assert.equal(app.simulationSettings.transitionDelays.weaponSwapMs, 250);
  assert.equal(second.simulationSettings.transitionDelays.weaponSwapMs, 500);
  const restored = parseBossScenario(JSON.parse(JSON.stringify(first)), 'mesmer', app.adapter.toApplicationBuild);
  assert.equal(restored.simulationSettings.transitionDelays.weaponSwapMs, 250);
  restored.simulationSettings.transitionDelays.weaponSwapMs = 999;
  assert.equal(first.simulationSettings.transitionDelays.weaponSwapMs, 250);
});

test('target armor presets use base by default and allow custom values', () => {
  assert.equal(STANDARD_TARGET_ARMOR, 2597);
  assert.deepEqual(TARGET_ARMOR_OPTIONS, [
    { value: 2597, label: 'Base' },
    { value: 1910, label: 'Vale Guardian / Keep Construct' },
    { value: 5346, label: 'McLeod' },
    { value: 2460, label: 'Berg' },
    { value: 2323, label: 'Zane' },
    { value: 2184, label: 'Narella' }
  ]);
  assert.equal(normalizeTargetArmor(1910), 1910);
  assert.equal(normalizeTargetArmor('2184'), 2184);
  assert.equal(normalizeTargetArmor(3210), 3210);
  assert.equal(normalizeTargetArmor('not armor'), STANDARD_TARGET_ARMOR);
});

test('shared app metadata owns common attributes and target conditions', () => {
  const defaultTargetConditions = createMesmerBuildDefaults().assumptions.targetConditions;

  assert.equal(PRIMARY_ATTRIBUTES.includes('Condition Damage'), true);
  assert.equal(Object.hasOwn(defaultTargetConditions, 'Fear'), false);
  assert.equal(Object.hasOwn(defaultTargetConditions, 'Taunt'), false);
  assert.equal(STACKING_TARGET_CONDITIONS.has('Vulnerability'), true);
  assert.equal(STACKING_TARGET_CONDITIONS.has('Burning'), false);
  assert.deepEqual(
    TARGET_CONDITION_GROUPS.map((group) => [group.label, [...group.conditions]]),
    [
      ['Damaging', ['Burning', 'Bleeding', 'Torment', 'Confusion', 'Poisoned']],
      [
        'Control',
        ['Vulnerability', 'Weakness', 'Blindness', 'Slow', 'Chilled', 'Crippled', 'Immobilized', 'Fear', 'Taunt']
      ]
    ]
  );
});
