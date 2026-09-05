import assert from 'node:assert/strict';
import test from 'node:test';
import { ProfessionApp } from '#gw2/app/profession-app.js';
import {
  addBuildTab,
  captureBuildDestination,
  closeBuildTab,
  createBuildTab,
  emptyBuildTabSession,
  loadBuildWorkspace,
  saveBuildWorkspace,
  workspaceStorageKey
} from '#gw2/app/build/state/workspace.js';
import { loadTemplateAction } from '#gw2/app/build/panels/presets.js';
import { recordRotationHistory, undoRotation } from '#gw2/app/rotation/editing/history.js';
import { BaselineSimulationRunner } from '#gw2/app/simulation/baseline-simulation-runner.js';
import { ModifierContributionRunner } from '#gw2/app/simulation/modifier-contribution-runner.js';
import { RandomDistributionRunner } from '#gw2/app/simulation/random-distribution-runner.js';

function storage(t, initial = {}) {
  const values = new Map(Object.entries(initial));
  stubGlobal(t, 'localStorage', {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  });
  return values;
}

function stubGlobal(t, name, value) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, name, previous);
    else delete globalThis[name];
  });
}

function build(marker = 'default') {
  return { profession: 'mesmer', gear: { Helm: marker }, selectedSkills: {}, rotation: [] };
}

const catalog = { skills: [], skillsByName: new Map(), skillsById: new Map() };
const adapter = {
  id: 'mesmer',
  storageKey: 'workspace-test',
  profession: {
    id: 'mesmer',
    catalog,
    createBuildDefaults: () => build(),
    migrateBuild: (value) => structuredClone(value),
    catalogFor(id) {
      if (!['current', 'preview'].includes(id)) throw new Error('Removed preview');
      return catalog;
    }
  },
  toApplicationBuild: (value) => structuredClone(value),
  eliteSpecialization: () => 'Core',
  slotLoadout: { normalizeBuild: () => ({}) },
  recalculate() {}
};

// A minimal editor exercises real tab activation and rotation history without a DOM or combat fixture.
function appFixture() {
  const tab = createBuildTab(build('original'), 'Original');
  const scheduled = [];
  const cancelled = [];
  const app = Object.assign(Object.create(ProfessionApp.prototype), emptyBuildTabSession(), {
    adapter,
    profession: adapter.profession,
    activeCatalog: catalog,
    workspace: { tabs: [tab], activeTabId: tab.id },
    build: tab.build,
    patchId: 'current',
    buildRevision: 1,
    resultRevision: 1,
    simulationStatus: 'idle',
    initialRenderGeneration: 0,
    baselineSimulationRunner: {
      cancel: () => cancelled.push('baseline'),
      schedule: (revision) => scheduled.push(revision)
    },
    randomDistributionRunner: { cancel: () => cancelled.push('rng'), schedule() {} },
    modifierContributionRunner: { cancel: () => cancelled.push('modifiers'), schedule() {} },
    relicComparisonRunner: { cancel: () => cancelled.push('relic'), schedule() {} },
    changed() {
      recordRotationHistory(this);
      this.buildRevision += 1;
      this.simulationStatus = 'queued';
      saveBuildWorkspace(this);
    }
  });
  recordRotationHistory(app);
  return { app, tab, scheduled, cancelled };
}

test('legacy build migrates once and workspace round trips only durable inputs and tab order', (t) => {
  const legacy = JSON.stringify(build('legacy'));
  const values = storage(t, { [adapter.storageKey]: legacy });
  const { app } = appFixture();
  app.workspace = loadBuildWorkspace(adapter);
  app.build = app.workspace.tabs[0].build;
  assert.equal(app.build.gear.Helm, 'legacy');
  const other = addBuildTab(app, build('second'), 'Second', 'preview');
  app.results = { dps: 17 };
  saveBuildWorkspace(app);
  const saved = JSON.parse(values.get(workspaceStorageKey(adapter)));
  assert.equal(saved.version, 1);
  assert.equal(saved.tabs[1].session, undefined);
  assert.equal(values.get(adapter.storageKey), legacy);
  const restored = loadBuildWorkspace(adapter);
  assert.deepEqual(
    restored.tabs.map(({ name, build: value }) => [name, value.gear.Helm]),
    [
      ['Build 1', 'legacy'],
      ['Second', 'second']
    ]
  );
  assert.equal(restored.activeTabId, other.id);
  assert.equal(restored.tabs[1].patchId, 'preview');
  assert.equal(restored.tabs[1].session.results, null);
});

test('workspace validation keeps valid tabs and handles missing active IDs and removed patches', (t) => {
  const tab = { id: 'valid', name: 'Valid', build: build(), patchId: 'removed' };
  storage(t, {
    [workspaceStorageKey(adapter)]: JSON.stringify({
      version: 1,
      activeTabId: 'missing',
      tabs: [null, {}, { ...tab, build: { profession: 'warrior' } }, tab, tab]
    })
  });
  const workspace = loadBuildWorkspace(adapter);
  assert.equal(workspace.tabs.length, 1);
  assert.equal(workspace.activeTabId, 'valid');
  assert.equal(workspace.tabs[0].patchId, 'current');
});

test('unreadable workspace falls back to the legacy build and failed saves retain edits', (t) => {
  storage(t, { [adapter.storageKey]: JSON.stringify(build('legacy')), [workspaceStorageKey(adapter)]: '{broken' });
  assert.equal(loadBuildWorkspace(adapter).tabs[0].build.gear.Helm, 'legacy');
  const { app } = appFixture();
  t.mock.method(globalThis.localStorage, 'setItem', () => {
    throw new Error('Full');
  });
  app.build.gear.Helm = 'edited';
  assert.doesNotThrow(() => saveBuildWorkspace(app));
  assert.equal(app.workspace.tabs[0].build.gear.Helm, 'edited');
  assert.match(app.workspace.storageError, /could not be saved/);
});

test('switching preserves independent rotations, history, templates, comparisons, and cached results', (t) => {
  storage(t);
  const { app, tab, scheduled, cancelled } = appFixture();
  app.build.rotation.push({ type: 'wait', durationMs: 10 });
  app.changed();
  app.results = { dps: 10 };
  app.resultRevision = app.buildRevision;
  app.simulationStatus = 'idle';
  app.currentTemplate = { build: 'template.json', signature: 'original' };
  app.templateUndoBuild = build('before-template');
  app.rotationComparison = { referenceRotation: [{ type: 'wait', durationMs: 20 }], referenceStatus: 'fresh' };
  const originalResult = app.results;
  const other = addBuildTab(app, build('other'), 'Other');
  assert.equal(app.results, null);
  assert.equal(app.currentTemplate, null);
  assert.equal(app.rotationComparison, null);
  assert.equal(app._rotationHistory.undo.length, 0);
  app.build.rotation.push({ type: 'wait', durationMs: 30 });
  app.changed();
  const before = scheduled.length;
  app.activateBuildTab(tab.id);
  assert.equal(app.results, originalResult);
  assert.equal(app.resultRevision, app.buildRevision);
  assert.equal(scheduled.length, before, 'fresh cached output needs no baseline job');
  assert.equal(app.currentTemplate.build, 'template.json');
  assert.equal(app.templateUndoBuild.gear.Helm, 'before-template');
  assert.equal(app.rotationComparison.referenceRotation[0].durationMs, 20);
  undoRotation(app);
  assert.deepEqual(app.build.rotation, []);
  app.activateBuildTab(other.id);
  assert.equal(app.build.rotation[0].durationMs, 30);
  assert.deepEqual(cancelled.slice(0, 4), ['baseline', 'rng', 'modifiers', 'relic']);
});

test('duplicated builds share no nested input objects or undo history', (t) => {
  storage(t);
  const { app, tab } = appFixture();
  app.build.rotation.push({ type: 'wait', durationMs: 10 });
  app.changed();
  addBuildTab(app, app.build, 'Copy');
  app.build.rotation[0].durationMs = 50;
  app.build.gear.Helm = 'copy';
  app.changed();
  assert.equal(tab.build.rotation[0].durationMs, 10);
  assert.equal(tab.build.gear.Helm, 'original');
  undoRotation(app);
  assert.equal(app.build.rotation[0].durationMs, 10);
});

test('close selects a neighbor, retains no closed builds, and preserves the final tab', (t) => {
  storage(t);
  const { app, tab } = appFixture();
  const other = addBuildTab(app, build('other'), 'Other');
  closeBuildTab(app, tab.id);
  assert.equal(app.workspace.activeTabId, other.id, 'closing an inactive tab keeps the current editor');
  const third = addBuildTab(app, build('third'), 'Third');
  closeBuildTab(app, third.id);
  assert.equal(app.workspace.activeTabId, other.id);
  closeBuildTab(app, other.id);
  assert.equal(app.workspace.tabs.length, 1);
  assert.equal(app.workspace.activeTabId, other.id);
  assert.equal(app.build.gear.Helm, 'other');
  assert.equal(app.workspace.closedTab, undefined);
  assert.equal(loadBuildWorkspace(adapter).tabs.length, 1);
});

test('async replacements reject switching away and back, even without a build edit', (t) => {
  storage(t);
  const { app, tab } = appFixture();
  const validate = captureBuildDestination(app);
  addBuildTab(app);
  app.activateBuildTab(tab.id);
  assert.throws(validate, /build changed while loading/);
});

test('template loading cannot overwrite a tab selected while its fetch is pending', async (t) => {
  storage(t);
  const { app, tab } = appFixture();
  let finish;
  const alerts = [];
  stubGlobal(t, 'alert', (message) => alerts.push(message));
  t.mock.method(
    globalThis,
    'fetch',
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const loading = loadTemplateAction(app, { label: 'Example', build: 'build.json' }, 'build', { innerHTML: 'Load' });
  addBuildTab(app, build('other'));
  finish({ ok: true, json: async () => build('downloaded') });
  await loading;
  assert.equal(app.build.gear.Helm, 'other');
  assert.equal(tab.build.gear.Helm, 'original');
  assert.match(alerts[0], /build changed while loading/);
});

test('open template in new tab commits the complete bundle and preserves the source tab', async (t) => {
  storage(t);
  const { app, tab } = appFixture();
  t.mock.method(globalThis, 'fetch', async (url) => ({
    ok: true,
    json: async () =>
      String(url).startsWith('rotation') ? { rotation: [{ type: 'wait', durationMs: 8 }] } : build('downloaded')
  }));
  await loadTemplateAction(app, { label: 'Example', build: 'build.json', rotation: 'rotation.json' }, 'new-tab', {
    innerHTML: 'Load'
  });
  assert.equal(app.workspace.tabs.length, 2);
  assert.equal(app.build.gear.Helm, 'downloaded');
  assert.equal(app.build.rotation[0].durationMs, 8);
  assert.equal(tab.build.gear.Helm, 'original');
  assert.equal(app.templateUndoBuild, null);
});

test('cancelled simulation workers cannot publish late output or failures into another tab', (t) => {
  const callbacks = [];
  const workers = [];
  t.mock.method(globalThis, 'setTimeout', (callback) => {
    callbacks.push(callback);
    return callbacks.length;
  });
  t.mock.method(globalThis, 'clearTimeout', () => {});
  stubGlobal(
    t,
    'Worker',
    class {
      constructor() {
        this.listeners = new Map();
        workers.push(this);
      }
      addEventListener(type, listener) {
        this.listeners.set(type, listener);
      }
      postMessage(message) {
        this.message = message;
      }
      terminate() {
        this.terminated = true;
      }
      respond(data) {
        this.listeners.get('message')({ data });
      }
    }
  );
  for (const Runner of [BaselineSimulationRunner, ModifierContributionRunner, RandomDistributionRunner]) {
    const app = {
      buildRevision: 1,
      build: { rotation: [{ type: 'wait', durationMs: 1 }] },
      results: {},
      randomDistributionRunner: { isRunning: false },
      adapter: {
        baselineSimulationRequest: () => ({}),
        modifierContributionRequest: () => ({ comparisons: [{}] }),
        randomDistributionRequest: () => ({ trials: 1 }),
        presentation: { createViewModel: () => ({}), render: () => assert.fail('Stale render') }
      },
      publishBaselineSimulation: () => assert.fail('Stale baseline'),
      failBaselineSimulation: () => assert.fail('Stale error')
    };
    const runner = new Runner(app);
    runner.schedule(1);
    callbacks.shift()();
    const worker = workers.at(-1);
    runner.cancel();
    assert.equal(worker.terminated, true);
    app.results = { marker: 'destination' };
    worker.respond({
      requestId: worker.message.requestId,
      output: {},
      contributions: [],
      distribution: { samples: [10] }
    });
    worker.respond({ requestId: worker.message.requestId, error: 'Late failure' });
    assert.deepEqual(app.results, { marker: 'destination' });
  }
});
