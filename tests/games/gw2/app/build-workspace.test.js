import assert from 'node:assert/strict';
import test from 'node:test';

import { createScenarioEditor } from '#gw2/app/boss-scenarios/editor.js';
import { createBossScenario, selectScenarioEncounter } from '#gw2/app/boss-scenarios/model.js';
import { loadTemplateAction, undoTemplateLoad } from '#gw2/app/build/library/actions.js';
import { deleteMyBuild, loadMyBuilds, myBuildsStorageKey, saveMyBuild } from '#gw2/app/build/library/storage.js';
import { loadBuild } from '#gw2/app/build/state/persistence.js';
import { availableSlotSkills } from '#gw2/app/build/state/skill-selection.js';
import { activateBuildTab } from '#gw2/app/build/state/tab-activation.js';
import { emptyBuildTabSession } from '#gw2/app/build/state/tab-session.js';
import {
  addBuildTab,
  captureBuildDestination,
  closeBuildTab,
  createBuildTab,
  loadBuildWorkspace,
  saveBuildWorkspace,
  workspaceStorageKey
} from '#gw2/app/build/state/workspace.js';
import { createAnalysisResultLifecycle } from '#gw2/app/create-analysis-lifecycle.js';
import { previewRotationFile } from '#gw2/app/import-export/rotation-import-dialog.js';
import { RelicComparisonRunner } from '#gw2/app/optimizer/relic-comparison/runner.js';
import { resolveEntrySkill } from '#gw2/app/rotation/editing/actions.js';
import { commitRotationEdit } from '#gw2/app/rotation/editing/commit.js';
import { captureAnalysisRequestSnapshot } from '#gw2/app/simulation/analysis-request-snapshot.js';
import { BaselineSimulationRunner } from '#gw2/app/simulation/baseline/runner.js';
import { ModifierContributionRunner } from '#gw2/app/simulation/modifier-contributions/runner.js';
import { RandomDistributionRunner } from '#gw2/app/simulation/random-distribution/runner.js';
import { defaultSimulationSettings } from '#gw2/app/simulation/settings.js';
import { analysisFixture } from '#tests/helpers/analysis-lifecycle.js';
import { patchSelectionFixture } from '#tests/helpers/patch-selection.js';
import { loadProfessionAppAdapter } from '#tests/helpers/profession-app-adapter.js';

function storage(t, initial = {}) {
  const values = new Map(Object.entries(initial));
  stubGlobal(t, 'localStorage', {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  });
  return values;
}

// Downloads, the old single-build slot, tabs, reset targets, and My Builds share the same legacy command migration.
test('saved legacy rotations load canonically from every persistence boundary', async (t) => {
  const values = storage(t);
  stubGlobal(
    t,
    'FileReader',
    class {
      async readAsText(file) {
        this.result = await file.text();
        this.onload();
      }
    }
  );
  for (const profession of [
    'elementalist',
    'engineer',
    'guardian',
    'mesmer',
    'necromancer',
    'ranger',
    'revenant',
    'thief',
    'warrior'
  ]) {
    const adapter = await loadProfessionAppAdapter(profession);
    const skill = adapter.profession.catalog.skills[0];
    const rotation = [
      { skillId: skill.id, offset: 120, interruptMs: 80 },
      { name: '__wait', waitMs: 250 },
      { name: '__combat_start', offset: -40 },
      { name: '__cooldown_reset' }
    ];
    const expected = [
      { type: 'cast', skillId: skill.id, concurrentOffsetMs: 120, interruptAfterMs: 80 },
      { type: 'wait', durationMs: 250 },
      { type: 'combat-start', concurrentOffsetMs: -40 },
      { type: 'cooldown-reset' }
    ];
    const saved = { ...adapter.profession.createBuildDefaults(), rotation };
    values.set(adapter.storageKey, JSON.stringify(saved));
    assert.deepEqual(loadBuild(adapter).rotation, expected, profession);
    assert.deepEqual(loadBuildWorkspace(adapter).tabs[0].build.rotation, expected, profession);
    values.set(
      workspaceStorageKey(adapter),
      JSON.stringify({
        version: 1,
        activeTabId: 'saved',
        tabs: [{ id: 'saved', name: 'Saved', build: saved, templateBuild: saved }]
      })
    );
    const workspace = loadBuildWorkspace(adapter);
    assert.deepEqual(workspace.tabs[0].build.rotation, expected, profession);
    assert.deepEqual(workspace.tabs[0].templateBuild.rotation, expected, profession);
    values.set(
      myBuildsStorageKey(adapter),
      JSON.stringify({
        version: 1,
        builds: [{ id: 'saved', name: 'Saved', build: saved }]
      })
    );
    assert.deepEqual(loadMyBuilds(adapter)[0].build.rotation, expected, profession);
    const file = new File([JSON.stringify({ rotation })], 'saved-rotation.json', { type: 'application/json' });
    const preview = await previewRotationFile(file, {
      patch: adapter.profession.resolvePatch(),
      activeCatalog: adapter.profession.catalog,
      adapter,
      build: workspace.tabs[0].build
    });
    assert.deepEqual(preview.rotation, expected, profession);
    saveBuildWorkspace({
      analysis: analysisFixture().lifecycle,
      adapter,
      profession: adapter.profession,
      workspace,
      build: workspace.tabs[0].build,
      patch: adapter.profession.resolvePatch({ id: 'current' })
    });
    assert.deepEqual(JSON.parse(values.get(workspaceStorageKey(adapter))).tabs[0].build.rotation, expected, profession);
  }
});

function stubGlobal(t, name, value) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, name, previous);
    else delete globalThis[name];
  });
}

function build(marker = 'default') {
  return { profession: 'mesmer', gear: { Helm: marker }, selectedSkillIds: {}, rotation: [] };
}

const catalog = { skills: [], skillsById: new Map() };
const adapter = {
  id: 'mesmer',
  storageKey: 'workspace-test',
  profession: {
    id: 'mesmer',
    catalog,
    createBuildDefaults: () => build(),
    migrateBuild: (value) => structuredClone(value),
    resolvePatch({ id, values }) {
      if (!['current', 'preview'].includes(id)) throw new Error('Removed preview');

      return patchSelectionFixture(catalog, { id, values });
    }
  },
  toApplicationBuild: (value) => structuredClone(value),
  eliteSpecialization: () => 'Core',
  slotLoadout: { normalizeBuild: () => ({}) },
  createBuildContext: () => ({ attributes: () => null, simulationConfig: () => ({}) })
};

// A minimal editor exercises real tab activation and rotation history without a DOM or combat fixture.
function appFixture() {
  const tab = createBuildTab(build('original'), 'Original');
  const simulationSettings = defaultSimulationSettings();
  const scheduled = [];
  const cancelled = [];
  const app = Object.assign({}, emptyBuildTabSession(), {
    adapter,
    profession: adapter.profession,
    workspace: { tabs: [tab], activeTabId: tab.id, simulationSettings },
    simulationSettings,
    build: tab.build,
    patch: adapter.profession.resolvePatch({ id: 'current' }),
    damageDiagnostics: false,
    baselineSimulationRunner: {
      cancel: () => cancelled.push('baseline'),
      run: (operation) => {
        app.pendingBaseline = operation;
        scheduled.push(app.analysis.state.buildRevision);
      }
    },
    randomDistributionRunner: { cancel: () => cancelled.push('rng'), run() {} },
    modifierContributionRunner: { cancel: () => cancelled.push('modifiers'), run() {} },
    relicComparisonRunner: { schedule() {} },
    changed() {
      this.analysis.changeInputs();
      saveBuildWorkspace(this);
    }
  });
  app.adapter = {
    ...adapter,
    captureAnalysis: (input) => captureAnalysisRequestSnapshot(input, adapter)
  };
  Object.defineProperty(app, 'activeCatalog', { get: () => app.patch.catalog });
  app.analysis = createAnalysisResultLifecycle(app, () => {});
  app.activateBuildTab = (tabId, workspace) => activateBuildTab(app, { tabId, workspace });
  app.analysis.restore({ results: null, patchComparison: null, fresh: false, inputs: null });
  cancelled.length = 0;
  return { app, tab, scheduled, cancelled };
}

// Workspace persistence also supports headless activation without installing browser storage.
test('headless activation returns false without touching an active or missing destination', () => {
  const unexpected = () => assert.fail('A no-op must not invoke activation operations');
  const { app, tab, scheduled, cancelled } = appFixture();
  app.workspace.persist = unexpected;
  app.gearOptimizerRunner = { reset: unexpected };
  app.relicComparisonRunner.schedule = unexpected;
  const initial = app.analysis.state;
  const session = tab.session;
  assert.equal(activateBuildTab(app, { tabId: tab.id }), false);
  assert.equal(activateBuildTab(app, { tabId: 'missing' }), false);
  const otherWorkspace = { tabs: [], activeTabId: '', simulationSettings: defaultSimulationSettings() };
  assert.equal(activateBuildTab(app, { tabId: 'missing', workspace: otherWorkspace }), false);
  assert.equal(app.analysis.state, initial);
  assert.equal(tab.session, session);
  assert.deepEqual(scheduled, []);
  assert.deepEqual(cancelled, []);
});

for (const lazyCatalog of [false, true]) {
  test(`invalid destination ${lazyCatalog ? 'catalog' : 'patch'} leaves the active session and jobs intact`, () => {
    const { app, tab, cancelled } = appFixture();
    app.workspace.persist = () => assert.fail('Unexpected save');
    app.analysis.refreshBaseline();
    const pending = app.pendingBaseline;
    const initial = app.analysis.state;
    const other = createBuildTab(build('other'), 'Unavailable', 'removed');
    app.workspace.tabs.push(other);

    if (lazyCatalog) {
      app.profession = {
        ...app.profession,
        resolvePatch: () => ({
          get catalog() {
            throw new Error('Unavailable catalog');
          }
        })
      };
    }

    cancelled.length = 0;
    assert.throws(() => activateBuildTab(app, { tabId: other.id }), /Removed preview|Unavailable catalog/);
    assert.equal(app.workspace.activeTabId, tab.id);
    assert.equal(app.build, tab.build);
    assert.equal(app.analysis.state, initial);
    assert.deepEqual(cancelled, []);
    pending.complete({ result: { dps: 10 } });
    assert.equal(app.analysis.state.results.dps, 10, 'the outgoing job remains valid');
  });
}

test('headless activation captures outgoing state and installs destination inputs before resuming analysis', () => {
  const saved = [];
  const { app, tab } = appFixture();
  app.build.rotation = [{ type: 'wait', durationMs: 20 }];
  app.rotationInsertionIndex = 0;
  app.dragState = { source: 'timeline', index: 0 };
  app.patch = app.profession.resolvePatch({ id: 'preview', values: { example: 2 } });
  app.analysis.refreshBaseline();
  const outgoing = app.pendingBaseline;
  const revision = app.analysis.state.buildRevision;
  const other = createBuildTab(build('destination'));
  other.build.rotation = [{ type: 'wait', durationMs: 10 }];
  other.session.rotationInsertionIndex = 99;
  other.session.attributeWeaponSet = 2;
  const workspace = { tabs: [other], activeTabId: other.id, simulationSettings: defaultSimulationSettings() };
  workspace.simulationSettings.transitionDelays.weaponSwapMs = 250;
  const originalWorkspace = app.workspace;
  for (const destination of [originalWorkspace, workspace]) {
    destination.persist = () =>
      saved.push({
        workspace: destination,
        activeTabId: destination.activeTabId,
        snapshot: destination.tabs.find(({ id }) => id === destination.activeTabId).analysis
      });
  }

  const order = [];
  app.baselineSimulationRunner.cancel = () => {
    // Cancellation may synchronously emit callbacks, including after destination installation.
    outgoing.complete({ result: { dps: -1 } });
    outgoing.fail(new Error('obsolete failure'));
  };

  app.gearOptimizerRunner = {
    reset() {
      assert.equal(app.build, tab.build);
      assert.equal(tab.session.rotationInsertionIndex, 0);
      assert.equal(tab.session.patchPreviewValues, app.patch.values);
      order.push('reset');
    }
  };
  app.adapter = {
    ...app.adapter,
    captureAnalysis(input) {
      assert.equal(input.simulationSettings, workspace.simulationSettings);
      assert.equal(input.patch, app.patch);
      return captureAnalysisRequestSnapshot(input, adapter);
    },
    slotLoadout: {
      normalizeBuild(_build, context) {
        assert.equal(app.analysis.state.results, null);
        assert.equal(context.professionState, undefined);
        assert.equal(app.build, other.build);
        order.push('normalize');
        return {};
      }
    },
    createBuildContext: ({ transitionDelays }) => ({
      attributes(weaponSet) {
        assert.equal(transitionDelays.weaponSwapMs, 250);
        assert.equal(weaponSet, 2);
        order.push('attributes');
        return { Power: 1234 };
      }
    })
  };
  app.relicComparisonRunner.schedule = () => {
    assert.equal(app.attributeData.Power, 1234);
    order.push('relics');
  };

  app.baselineSimulationRunner.run = (operation) => {
    assert.equal(app.workspace, workspace);
    assert.equal(app.simulationSettings, workspace.simulationSettings);
    assert.equal(app.activeCatalog, app.patch.catalog);
    assert.equal(app.rotationInsertionIndex, null);
    assert.equal(app.dragState, null);
    order.push('resume');
    operation.complete({ result: { dps: 20 } });
  };

  assert.equal(activateBuildTab(app, { tabId: other.id, workspace }), true);
  assert.deepEqual(order, ['reset', 'normalize', 'attributes', 'relics', 'resume']);
  assert.deepEqual(
    saved.map(({ workspace }) => workspace),
    [originalWorkspace, workspace]
  );
  assert.equal(saved[0].activeTabId, tab.id);
  assert.equal(saved[1].activeTabId, other.id);
  assert.equal(saved[1].snapshot.fresh, true, 'synchronous publication is captured before persistence');
  assert.equal(saved[1].snapshot.results, app.analysis.state.results);
  assert.ok(app.analysis.state.buildRevision > revision);
  assert.equal(app.analysis.state.results.dps, 20);
  outgoing.complete({ result: { dps: -2 } });
  outgoing.fail(new Error('late failure'));
  assert.equal(app.analysis.state.results.dps, 20);
  assert.equal(app.analysis.state.simulationError, '');
});

// Changing encounter assumptions never switches the active rotation document or leaks into Golem.
test('encounter editor keeps one rotation and history across boss and difficulty changes', (t) => {
  const values = storage(t);
  const { app } = appFixture();
  commitRotationEdit(app, { type: 'insert', entries: [{ type: 'wait', durationMs: 1000 }] });
  const golem = app.workspace;
  const golemHistory = app._rotationHistory;
  const savedGolem = values.get(workspaceStorageKey(adapter));
  const draft = createBossScenario('020102', app.build, 'Encounter build', 'current', true);
  let savedDraft;
  const fileActions = { import() {}, export() {} };
  const editor = createScenarioEditor(
    app,
    () => {
      savedDraft = structuredClone(draft);
    },
    fileActions
  );
  const validateGolemImport = captureBuildDestination(app);
  editor.open(draft);
  // Header transfers follow the active encounter workspace and disappear when Golem is restored.
  assert.equal(app.workspace.fileActions, fileActions);
  assert.throws(validateGolemImport, /build changed/);
  app.build.gear.Helm = 'encounter gear';
  commitRotationEdit(app, { type: 'insert', entries: [{ type: 'wait', durationMs: 2000 }] }, { rebuildStatic: true });
  let bossHistory = app._rotationHistory;
  selectScenarioEncounter(draft, '020403', 'challenge');
  editor.open(draft);
  assert.equal(app._rotationHistory, bossHistory);
  assert.equal(app.build.rotation.length, 2);
  assert.equal(app.workspace.tabs.length, 1);
  commitRotationEdit(app, { type: 'undo' });
  assert.deepEqual(savedDraft.build.rotation, [{ type: 'wait', durationMs: 1000 }]);
  assert.equal(app.build.gear.Helm, 'encounter gear');
  bossHistory = app._rotationHistory;
  assert.equal(values.get(workspaceStorageKey(adapter)), savedGolem);
  editor.close();
  assert.equal(app.workspace, golem);
  assert.equal(app.workspace.fileActions, undefined);
  assert.equal(app.build.gear.Helm, 'original');
  assert.equal(app._rotationHistory, golemHistory);
  editor.open(draft);
  assert.equal(app._rotationHistory, bossHistory);
  assert.equal(app.build.gear.Helm, 'encounter gear');
  assert.deepEqual(app.build.rotation, [{ type: 'wait', durationMs: 1000 }]);
});

// Closing releases the encounter's cached workspace while retaining the independent Golem editing session.
test('discarding an encounter releases its editor session and restores Golem', (t) => {
  storage(t);
  const { app } = appFixture();
  const golem = app.workspace;
  const draft = createBossScenario('020102', app.build, 'Encounter build', 'current', true);
  const editor = createScenarioEditor(app, () => {}, { import() {}, export() {} });
  editor.open(draft);
  const discarded = app.workspace;
  commitRotationEdit(app, { type: 'insert', entries: [{ type: 'wait', durationMs: 1000 }] });
  editor.discard(draft.id);
  assert.equal(app.workspace, golem);
  assert.deepEqual(app.build.rotation, []);
  editor.open(draft);
  assert.notEqual(app.workspace, discarded);
  assert.deepEqual(app.build.rotation, [{ type: 'wait', durationMs: 1000 }]);
});

test('legacy build migrates once and workspace round trips only durable inputs and tab order', (t) => {
  const legacy = JSON.stringify(build('legacy'));
  const values = storage(t, { [adapter.storageKey]: legacy });
  const { app } = appFixture();
  app.workspace = loadBuildWorkspace(adapter);
  app.build = app.workspace.tabs[0].build;
  assert.equal(app.build.gear.Helm, 'legacy');
  addBuildTab(app, build('second'), 'Second', 'preview');
  const other = app.workspace.tabs.at(-1);
  publishResult(app, { dps: 17 });
  // Experiments travel with in-memory tab sessions but never enter durable builds or workspace JSON.
  app.patch = app.profession.resolvePatch({ id: 'preview', values: { ashesStacks: 2 } });
  saveBuildWorkspace(app);
  const saved = JSON.parse(values.get(workspaceStorageKey(adapter)));
  assert.equal(saved.version, 1);
  assert.equal(saved.tabs[1].session, undefined);
  assert.equal(JSON.stringify(saved).includes('ashesStacks'), false);
  assert.deepEqual(other.session.patchPreviewValues, { ashesStacks: 2 });
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
  assert.equal(restored.tabs[1].analysis.results, null);
  assert.equal(restored.tabs[1].session.patchPreviewValues, undefined);
});

test('workspace save and load give empty infusion selections two unequipped rows', async (t) => {
  const values = storage(t);
  const warrior = await loadProfessionAppAdapter('warrior');
  const build = warrior.profession.createBuildDefaults();
  build.infusions = [];
  assert.equal(warrior.profession.validateBuild(build).valid, true);
  const tab = createBuildTab(build);
  // Exercise the real codec on both sides of persistence so saving cannot restore unwanted stats.
  const app = {
    analysis: analysisFixture().lifecycle,
    adapter: warrior,
    profession: warrior.profession,
    build,
    patch: warrior.profession.resolvePatch({ id: 'current' }),
    workspace: { tabs: [tab], activeTabId: tab.id }
  };
  saveBuildWorkspace(app);
  const saved = JSON.parse(values.get(workspaceStorageKey(warrior))).tabs[0].build;
  const restored = loadBuildWorkspace(warrior).tabs[0].build;
  const emptyRows = [
    { stat: 'Power', count: 0 },
    { stat: 'Precision', count: 0 }
  ];
  assert.deepEqual(saved.infusions, emptyRows);
  assert.deepEqual(restored.infusions, emptyRows);
  assert.deepEqual(build.infusions, []);
});

// Legacy presets often have unused rows before their equipped stats; keep allocations when shrinking the editor.
test('workspace loading compacts legacy infusion rows and caps allocations to two stats', async (t) => {
  const values = storage(t);
  const warrior = await loadProfessionAppAdapter('warrior');
  const build = warrior.profession.createBuildDefaults();
  for (const [infusions, expected] of [
    [
      [
        { stat: 'Power', count: 0 },
        { stat: 'Precision', count: 0 },
        { stat: 'Condition Damage', count: 18 }
      ],
      [
        { stat: 'Condition Damage', count: 18 },
        { stat: 'Power', count: 0 }
      ]
    ],
    [
      [
        { stat: 'Power', count: 4 },
        { stat: 'Power', count: 8 },
        { stat: 'Expertise', count: 99 }
      ],
      [
        { stat: 'Power', count: 12 },
        { stat: 'Expertise', count: 6 }
      ]
    ],
    [
      [
        { stat: 'Power', count: 2 },
        { stat: 'Precision', count: 6 },
        { stat: 'Expertise', count: 10 }
      ],
      [
        { stat: 'Expertise', count: 10 },
        { stat: 'Precision', count: 6 }
      ]
    ],
    [
      [{ stat: 'Expertise', count: 4 }],
      [
        { stat: 'Expertise', count: 4 },
        { stat: 'Power', count: 0 }
      ]
    ]
  ]) {
    values.set(warrior.storageKey, JSON.stringify({ ...build, infusions }));
    assert.deepEqual(loadBuildWorkspace(warrior).tabs[0].build.infusions, expected);
  }
});

test('legacy missing and malformed infusion selections still receive defaults', async (t) => {
  const values = storage(t);
  const warrior = await loadProfessionAppAdapter('warrior');
  const build = warrior.profession.createBuildDefaults();
  const defaults = build.infusions;
  delete build.infusions;
  for (const fields of [{}, { infusions: null }, { infusions: [{ stat: 'invalid', count: 18 }] }]) {
    values.set(warrior.storageKey, JSON.stringify({ ...build, ...fields }));
    assert.deepEqual(loadBuildWorkspace(warrior).tabs[0].build.infusions, defaults);
  }
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

test('My Builds validates, saves, overwrites, and deletes independent snapshots', (t) => {
  const values = storage(t, {
    [myBuildsStorageKey(adapter)]: JSON.stringify({
      version: 1,
      builds: [
        { id: 'saved', name: ' Saved ', category: ' Raids ', build: build('saved') },
        { id: 'saved', name: 'Duplicate', build: build('duplicate') },
        { id: 'wrong', name: 'Wrong profession', build: { ...build(), profession: 'warrior' } }
      ]
    })
  });
  const { app } = appFixture();
  let library = loadMyBuilds(adapter);
  assert.deepEqual(
    library.map(({ id, name, category, build: value }) => [id, name, category, value.gear.Helm]),
    [['saved', 'Saved', 'Raids', 'saved']]
  );

  app.build.gear.Helm = 'new';
  library = saveMyBuild(app, ' New build ', undefined, ' Fractals ');
  const newEntry = library[1];
  app.build.gear.Helm = 'edited-after-save';
  assert.equal(newEntry.build.gear.Helm, 'new');

  app.build.gear.Helm = 'replacement';
  library = saveMyBuild(app, 'Renamed', newEntry.id, 'Benchmarks');
  assert.deepEqual(
    library.map(({ name, category, build: value }) => [name, category, value.gear.Helm]),
    [
      ['Saved', 'Raids', 'saved'],
      ['Renamed', 'Benchmarks', 'replacement']
    ]
  );

  library = deleteMyBuild(app, 'saved');
  assert.equal(library.length, 1);
  assert.deepEqual(
    loadMyBuilds(adapter).map(({ name }) => name),
    ['Renamed']
  );
  assert.equal(JSON.parse(values.get(myBuildsStorageKey(adapter))).version, 1);
});

test('My Builds merges with saves made in another browser tab', (t) => {
  const values = storage(t);
  const { app } = appFixture();
  const otherTab = { ...app, build: build('other-tab') };

  const first = saveMyBuild(app, 'This tab');
  saveMyBuild(otherTab, 'Other tab');
  // This tab still holds its stale one-entry list; the next save must keep the other tab's entry.
  assert.equal(first.length, 1);
  const merged = saveMyBuild(app, 'This tab again');
  assert.deepEqual(
    merged.map(({ name }) => name),
    ['This tab', 'Other tab', 'This tab again']
  );

  // Overwriting or deleting reads the stored library, so an entry removed elsewhere is reported, not resurrected.
  deleteMyBuild(otherTab, first[0].id);
  assert.throws(() => saveMyBuild(app, 'Resurrected', first[0].id), /no longer exists/);
  assert.deepEqual(
    JSON.parse(values.get(myBuildsStorageKey(adapter))).builds.map(({ name }) => name),
    ['Other tab', 'This tab again']
  );
});

// Tab activation changes the catalog used by skill consumers even when both patches share an identity.
test('switching tabs uses each patch catalog for skill lists and lookups', (t) => {
  storage(t);
  const { app, tab } = appFixture();
  const catalogs = Object.fromEntries(
    ['current', 'preview'].map((id) => {
      const skill = { id: 1, name: `${id} utility`, type: 'Utility' };
      return [id, { skills: [skill], skillsById: new Map([[skill.id, skill]]) }];
    })
  );
  app.profession = {
    ...app.profession,
    ui: {},
    catalog: catalogs.current,
    resolvePatch: (selection) => patchSelectionFixture(catalogs[selection.id], selection),
    // No trait selects another skill identity in this fixture.
    runtimeFor: () => ({})
  };
  app.adapter = {
    ...app.adapter,
    profession: app.profession,
    isSkillAvailable: () => true,
    createBuildContext: () => ({ attributes: () => null, simulationConfig: () => ({ selectedTraitIds: [] }) })
  };
  app.patch = app.profession.resolvePatch({ id: 'current' });
  addBuildTab(app, build('preview'), 'Preview', 'preview');
  const other = app.workspace.tabs.at(-1);
  for (const [id, patch] of [
    [other.id, 'preview'],
    [tab.id, 'current'],
    [other.id, 'preview']
  ]) {
    app.activateBuildTab(id);
    const skill = catalogs[patch].skills[0];
    assert.deepEqual(availableSlotSkills(app, 'Utility'), [skill]);
    assert.equal(resolveEntrySkill(app, { type: 'cast', skillId: 1 }), skill);
    assert.equal(resolveEntrySkill(app, { type: 'cast', skillId: 1 }), skill);
  }
});

test('switching preserves independent rotations, history, templates, comparisons, and cached results', (t) => {
  storage(t);
  const { app, tab, scheduled, cancelled } = appFixture();
  commitRotationEdit(app, { type: 'insert', entries: [{ type: 'wait', durationMs: 10 }] });
  publishResult(app, { dps: 10 });
  app.currentTemplate = { build: 'template.json', signature: 'original' };
  app.templateUndoBuild = build('before-template');
  app.rotationComparison = { referenceRotation: [{ type: 'wait', durationMs: 20 }], referenceStatus: 'fresh' };
  // Feature-local defaults must reset tab-owned filters and sorting while retaining shared display preferences.
  app.procVisibility = new Set(['first-proc']);
  app.procFilterOpen = true;
  app._skillSortCol = 'name';
  app._skillSortDir = 'asc';
  app.timelineOverlayVisibility = { trait: false };
  const originalFilters = app.procVisibility;
  const sharedOverlays = app.timelineOverlayVisibility;
  const originalResult = app.analysis.state.results;
  addBuildTab(app, build('other'), 'Other');
  const other = app.workspace.tabs.at(-1);
  assert.equal(app.analysis.state.results, null);
  assert.equal(app.currentTemplate, null);
  assert.equal(app.rotationComparison, null);
  assert.equal(app._rotationHistory.undo.length, 0);
  assert.equal(app.procVisibility, undefined);
  assert.equal(app.procFilterOpen, false);
  assert.equal(app._skillSortCol, null);
  assert.equal(app._skillSortDir, null);
  assert.equal(app.timelineOverlayVisibility, sharedOverlays);
  app.procVisibility = new Set(['other-proc']);
  app._skillSortCol = 'dps';
  commitRotationEdit(app, { type: 'insert', entries: [{ type: 'wait', durationMs: 30 }] });
  const before = scheduled.length;
  app.activateBuildTab(tab.id);
  assert.equal(app.analysis.state.results, originalResult);
  assert.equal(app.analysis.state.resultRevision, app.analysis.state.buildRevision);
  assert.equal(scheduled.length, before, 'fresh cached output needs no baseline job');
  assert.equal(app.currentTemplate.build, 'template.json');
  assert.equal(app.templateUndoBuild.gear.Helm, 'before-template');
  assert.equal(app.rotationComparison.referenceRotation[0].durationMs, 20);
  assert.equal(app.procVisibility, originalFilters);
  assert.deepEqual([...app.procVisibility], ['first-proc']);
  assert.equal(app.procFilterOpen, true);
  assert.equal(app._skillSortCol, 'name');
  assert.equal(app._skillSortDir, 'asc');
  assert.equal(app.timelineOverlayVisibility, sharedOverlays);
  commitRotationEdit(app, { type: 'undo' });
  assert.deepEqual(app.build.rotation, []);
  app.activateBuildTab(other.id);
  assert.equal(app.build.rotation[0].durationMs, 30);
  assert.ok(['baseline', 'rng', 'modifiers'].every((kind) => cancelled.includes(kind)));
});

// Shared comparison controls follow the tool across fresh and stale tabs instead of restoring from tab results.
test('relic comparison selections follow the active tool across build tabs', (t) => {
  storage(t);
  const { app, tab } = appFixture();
  app.relicNames = ['Akeem', 'Fractal', 'Thorns'];
  app.build.relic = 'Fractal';
  app.build.rotation = [{ type: 'wait', durationMs: 1000 }];
  publishResult(app, { dps: 10 });
  app.relicComparisonRunner = new RelicComparisonRunner(app);
  const runner = app.relicComparisonRunner;
  runner.select('Thorns', 7);
  addBuildTab(app, { ...build('other'), relic: 'Fractal' }, 'Other');
  const other = app.workspace.tabs.at(-1);
  assert.equal(app.analysis.state.results, null);
  assert.equal(runner.comparisonRelic, 'Thorns');
  assert.equal(runner.initialStacks, 7);
  runner.select('Akeem', 3);
  app.activateBuildTab(tab.id);
  assert.equal(app.analysis.state.results.dps, 10, 'the first tab restores its cached baseline');
  assert.equal(runner.comparisonRelic, 'Akeem', 'cached tabs use the current shared choice');
  assert.equal(runner.initialStacks, 3);
  app.activateBuildTab(other.id);
  assert.equal(app.analysis.state.results, null, 'the second tab still needs a baseline');
  assert.equal(runner.comparisonRelic, 'Akeem');
  assert.equal(runner.initialStacks, 3);
});

// Session capture changes invalidate cached results without persisting diagnostic preferences in builds.
test('switching tabs recaptures cached baselines when the session debug mode changes', (t) => {
  storage(t);
  const { app, tab, scheduled } = appFixture();
  app.damageDiagnostics = false;
  publishResult(app, { dps: 10 });
  addBuildTab(app, build('other'), 'Other');
  const other = app.workspace.tabs.at(-1);
  app.damageDiagnostics = true;
  const before = scheduled.length;
  app.activateBuildTab(tab.id);
  assert.equal(app.damageDiagnostics, true);
  assert.equal(app.analysis.state.results, null);
  assert.equal(scheduled.length, before + 1);
  publishResult(app, { dps: 10, debugInputs: {} });
  app.activateBuildTab(other.id);
  const captured = scheduled.length;
  app.activateBuildTab(tab.id);
  assert.ok(app.analysis.state.results.debugInputs);
  assert.equal(scheduled.length, captured, 'matching captured output can be reused');
});

test('duplicated builds share no nested input objects or undo history', (t) => {
  storage(t);
  const { app, tab } = appFixture();
  commitRotationEdit(app, { type: 'insert', entries: [{ type: 'wait', durationMs: 10 }] });
  tab.templateBuild = build('template');
  addBuildTab(app, app.build, 'Copy', app.patch.id, tab.templateBuild);
  const copy = app.workspace.tabs.at(-1);
  assert.deepEqual(copy.templateBuild, tab.templateBuild);
  copy.templateBuild.gear.Helm = 'copy-template';
  assert.equal(tab.templateBuild.gear.Helm, 'template');
  app.build.gear.Helm = 'copy';
  commitRotationEdit(app, { type: 'update', index: 0, changes: { durationMs: 50 } }, { rebuildStatic: true });
  assert.equal(tab.build.rotation[0].durationMs, 10);
  assert.equal(tab.build.gear.Helm, 'original');
  commitRotationEdit(app, { type: 'undo' });
  assert.equal(app.build.rotation[0].durationMs, 10);
});

test('close selects a neighbor, retains no closed builds, and preserves the final tab', (t) => {
  storage(t);
  const { app, tab } = appFixture();
  addBuildTab(app, build('other'), 'Other');
  const other = app.workspace.tabs.at(-1);
  closeBuildTab(app, tab.id);
  assert.equal(app.workspace.activeTabId, other.id, 'closing an inactive tab keeps the current editor');
  addBuildTab(app, build('third'), 'Third');
  const third = app.workspace.tabs.at(-1);
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

test('template build loads rename only the active tab and persist its name', async (t) => {
  storage(t);
  t.mock.method(globalThis, 'fetch', async (url) => ({
    ok: true,
    json: async () => (String(url).startsWith('rotation') ? { rotation: [] } : build('downloaded'))
  }));
  const preset = { section: 'Chronomancer', label: 'Power', build: 'build.json', rotation: 'rotation.json' };

  // Both build replacement actions adopt the template identity, while loading just a rotation keeps the tab name.
  for (const action of ['template', 'build', 'rotation']) {
    const { app, tab } = appFixture();
    addBuildTab(app, build('other'), 'Custom name');
    const active = app.workspace.tabs.at(-1);
    await loadTemplateAction(app, preset, action, { innerHTML: 'Load' });
    const expectedName = action === 'rotation' ? 'Custom name' : 'Chronomancer · Power';
    assert.equal(active.name, expectedName);
    assert.equal(tab.name, 'Original');
    assert.equal(app.workspace.tabs.length, 2);
    // Editing a loaded build must not mutate the durable reset target, and rotation-only loads create none.
    app.build.gear.Helm = 'edited';
    app.changed();
    const restored = loadBuildWorkspace(adapter);
    assert.equal(restored.tabs.find(({ id }) => id === active.id).name, expectedName);
    assert.equal(
      restored.tabs.find(({ id }) => id === active.id).templateBuild?.gear.Helm,
      action === 'rotation' ? undefined : 'downloaded'
    );
    assert.equal(restored.tabs.find(({ id }) => id === tab.id).templateBuild, undefined);
  }
});

// Undo must restore the reset baseline too, including the absence of a template on a blank tab.
test('template undo restores each tab reset target across tab switches and persistence', async (t) => {
  storage(t);
  t.mock.method(globalThis, 'fetch', async (url) => ({
    ok: true,
    json: async () =>
      String(url).startsWith('rotation') ? { rotation: [{ type: 'wait', durationMs: 8 }] } : build('downloaded')
  }));
  for (const action of ['build', 'template', 'rotation']) {
    for (const baseline of [undefined, build('previous-template')]) {
      const { app, tab } = appFixture();
      tab.templateBuild = baseline;
      await loadTemplateAction(app, { label: 'Example', build: 'build.json', rotation: 'rotation.json' }, action, {});
      addBuildTab(app, build('other'), 'Other');
      const other = app.workspace.tabs.at(-1);
      app.activateBuildTab(tab.id);
      undoTemplateLoad(app);
      assert.equal(app.build.gear.Helm, 'original');
      assert.deepEqual(tab.templateBuild, baseline);
      assert.equal(other.templateBuild, undefined);
      assert.deepEqual(loadBuildWorkspace(adapter).tabs.find(({ id }) => id === tab.id).templateBuild, baseline);
    }
  }
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
  assert.deepEqual(app.workspace.tabs[1].templateBuild, app.build);
  assert.notEqual(app.workspace.tabs[1].templateBuild, app.build);
});

test('invalid saved template targets preserve the tab and fall back to defaults', (t) => {
  const values = storage(t);
  for (const templateBuild of [null, [], { profession: 'warrior' }]) {
    values.set(
      workspaceStorageKey(adapter),
      JSON.stringify({
        version: 1,
        activeTabId: 'saved',
        tabs: [{ id: 'saved', name: 'Saved', build: build('edited'), templateBuild }]
      })
    );
    const restored = loadBuildWorkspace(adapter);
    assert.equal(restored.tabs[0].build.gear.Helm, 'edited');
    assert.equal(restored.tabs[0].templateBuild, undefined);
  }
});

test('cancelled execution adapters cannot publish late output or errors', (t) => {
  const callbacks = [];
  t.mock.method(globalThis, 'setTimeout', (callback) => {
    callbacks.push(callback);
    return callbacks.length;
  });
  t.mock.method(globalThis, 'clearTimeout', () => {});
  const workers = [];
  stubGlobal(
    t,
    'Worker',
    class {
      listeners = new Map();
      constructor() {
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
        this.listeners.get('message')({ data: { requestId: this.message.requestId, ...data } });
      }
    }
  );
  for (const Runner of [BaselineSimulationRunner, ModifierContributionRunner, RandomDistributionRunner]) {
    const runner = new Runner(() => assert.fail('Worker expected'));
    runner.run({
      request: {
        rotation: [],
        trials: 1,
        baselineDps: 10,
        comparisons: [{ modifier: { id: 'a', name: 'A' }, config: {} }]
      },
      baseline: { events: [], resolvedEvents: [] },
      started() {},
      ready: () => true,
      complete: () => assert.fail('Stale completion'),
      progress: () => assert.fail('Stale progress'),
      fail: () => assert.fail('Stale failure')
    });
    callbacks.shift()();
    const worker = workers.at(-1);
    runner.cancel();
    assert.equal(worker.terminated, true);
    worker.respond({ output: { result: {} }, scores: [], outcomes: [{ dps: 10, metrics: [] }] });
    worker.respond({ error: 'late' });
  }
});

/** Feed an accepted result through the same callback that completes browser work. */
function publishResult(app, result) {
  app.analysis.refreshBaseline();
  app.pendingBaseline.complete({ result });
}
