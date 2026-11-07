import assert from 'node:assert/strict';
import test from 'node:test';

import { loadMyBuildEntry, loadTemplateAction, undoTemplateLoad } from '#gw2/app/build/library/actions.js';
import { loadPresetBundle } from '#gw2/app/build/library/assets.js';
import { beginLibraryLoad, loadLibraryTemplate } from '#gw2/app/build/library/load.js';
import { templateBoon, templateCategory, templateSpecializations } from '#gw2/app/build/library/model.js';
import { normalizeRotation } from '#gw2/platform/builds/rotation.js';
import { normalizeTransitionDelays } from '#gw2/platform/execution/transition-lockouts.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { engineerAppAdapter } from '#gw2/professions/engineer/app/app-definition.js';
import { mesmerAppAdapter } from '#gw2/professions/mesmer/app/app-definition.js';
import { MESMER_SKILL_IDS as MESMER_ID } from '#gw2/professions/mesmer/data/ids.js';

function createApp() {
  return {
    analysis: {
      needsPatchComparison: () => false,
      state: {
        results: null,
        buildRevision: 0,
        resultRevision: 0,
        simulationStatus: 'idle',
        simulationError: '',
        patchComparison: null
      }
    },
    patch: mesmerAppAdapter.profession.resolvePatch(),
    adapter: {
      id: 'mesmer',
      profession: {},
      eliteSpecialization: () => 'Core',
      slotLoadout: { normalizeBuild: () => ({}) },
      storageKey: 'test-build',
      toApplicationBuild: (build) => ({
        ...structuredClone(build),
        rotation: normalizeRotation(Array.isArray(build.rotation) ? build.rotation : [], null, { strict: true })
      })
    },
    build: {
      profession: 'mesmer',
      marker: 'current',
      rotation: [{ type: 'cast', skillId: 'Current rotation' }]
    },
    changedCalls: [],
    changed(...args) {
      this.changedCalls.push(args);
    },
    currentTemplate: null,
    templateContainer: null,
    templateUndo: null
  };
}

// Browser tests cover profession-scoped manifest loading and picker initialization, which require a real document.
test('template metadata classifies damage type and boon roles', () => {
  const power = {
    label: 'Power',
    build: 'data/gw2/builds/mesmer/b-power-chronomancer.json',
    section: 'Chronomancer'
  };
  const condi = {
    label: 'Condition',
    build: 'data/gw2/builds/mesmer/b-condi-chronomancer.json',
    section: 'Chronomancer'
  };
  const powerBoon = {
    label: 'Power Quickness',
    build: 'data/gw2/builds/thief/b-power-quick-deadeye.json',
    section: 'Deadeye'
  };
  const condiBoon = {
    label: 'Condition Alacrity',
    build: 'data/gw2/builds/engineer/b-condi-alac-amalgam.json',
    section: 'Amalgam'
  };
  const inferno = {
    label: 'Inferno',
    build: 'data/gw2/builds/elementalist/b-inferno-tempest.json',
    section: 'Tempest'
  };
  const otherBoon = {
    label: 'Inferno Alacrity',
    build: 'data/gw2/builds/elementalist/b-inferno-alac-tempest.json',
    section: 'Tempest'
  };

  assert.equal(templateCategory(power), 'power');
  assert.equal(templateCategory(condi), 'condi');
  assert.equal(templateCategory(powerBoon), 'power');
  assert.equal(templateCategory(condiBoon), 'condi');
  assert.equal(templateCategory(inferno), 'power');
  assert.equal(templateCategory({ label: 'Custom', build: 'custom.json' }), 'other');
  assert.equal(templateBoon(power), 'none');
  assert.equal(templateBoon(powerBoon), 'quickness');
  assert.equal(templateBoon(condiBoon), 'alacrity');
  assert.equal(templateBoon(otherBoon), 'alacrity');
});

test('specialization filters come from unique manifest section names', () => {
  const manifest = [
    { section: 'Weaver', presets: [] },
    { section: 'Tempest', presets: [] },
    { section: 'Weaver', presets: [] }
  ];

  assert.deepEqual(templateSpecializations(manifest), ['Weaver', 'Tempest']);
});

// Independent template assets must start together even when the build download has not completed.
test('template bundles fetch build and rotation concurrently', async (t) => {
  const { promise: buildReady, resolve: releaseBuild } = Promise.withResolvers();
  const requested = [];
  t.mock.method(globalThis, 'fetch', async (url) => {
    const path = String(url).split('?')[0];
    requested.push(path);

    if (path === 'build.json') await buildReady;

    return { ok: true, json: async () => (path === 'build.json' ? { profession: 'mesmer' } : { rotation: [] }) };
  });
  const loading = loadPresetBundle({ build: 'build.json', rotation: 'rotation.json' });
  assert.deepEqual(requested, ['build.json', 'rotation.json']);
  releaseBuild();
  assert.deepEqual(await loading, { buildData: { profession: 'mesmer' }, rotationItems: [] });
});

test('template actions load paired or partial state and support undo', async (t) => {
  const payloads = new Map([
    [
      'data/gw2/builds/mesmer/test-build.json',
      {
        profession: 'mesmer',
        marker: 'template',
        rotation: ['Embedded rotation is ignored']
      }
    ],
    ['data/gw2/rotations/mesmer/test-rotation.json', { rotation: ['Template rotation'] }]
  ]);

  t.mock.method(globalThis, 'fetch', async (url) => {
    const path = String(url).split('?')[0];
    const payload = payloads.get(path);

    return {
      ok: payload !== undefined,
      json: async () => structuredClone(payload)
    };
  });
  const preset = {
    section: 'Chronomancer',
    label: 'Power',
    build: 'data/gw2/builds/mesmer/test-build.json',
    rotation: 'data/gw2/rotations/mesmer/test-rotation.json'
  };

  const templateApp = createApp();

  await loadTemplateAction(templateApp, preset, 'template');
  assert.equal(templateApp.build.marker, 'template');
  assert.deepEqual(templateApp.build.rotation, [{ type: 'cast', skillId: 'Template rotation' }]);
  assert.deepEqual(templateApp.changedCalls, [[true, true, { deferRotationRender: true }]]);
  assert.equal(templateApp.currentTemplate.build, preset.build);

  undoTemplateLoad(templateApp);
  assert.equal(templateApp.build.marker, 'current');
  assert.deepEqual(templateApp.build.rotation, [{ type: 'cast', skillId: 'Current rotation' }]);
  assert.deepEqual(templateApp.changedCalls, [
    [true, true, { deferRotationRender: true }],
    [true, true, { deferRotationRender: true }]
  ]);

  const buildOnlyApp = createApp();

  await loadTemplateAction(buildOnlyApp, preset, 'build');
  assert.equal(buildOnlyApp.build.marker, 'template');
  assert.deepEqual(buildOnlyApp.build.rotation, [{ type: 'cast', skillId: 'Current rotation' }]);
  assert.deepEqual(buildOnlyApp.changedCalls, [[true, true, { deferRotationRender: true }]]);

  const rotationOnlyApp = createApp();

  await loadTemplateAction(rotationOnlyApp, preset, 'rotation');
  assert.equal(rotationOnlyApp.build.marker, 'current');
  assert.deepEqual(rotationOnlyApp.build.rotation, [{ type: 'cast', skillId: 'Template rotation' }]);
  assert.deepEqual(
    rotationOnlyApp.changedCalls.map(([rebuildStatic, rebuildGear]) => [rebuildStatic, rebuildGear]),
    [[false, false]]
  );
});

test('template loading preserves explicit Mesmer variant IDs before the first simulation', async (t) => {
  // Only weapon selection is needed to disambiguate the imported axe skill; preset gear is irrelevant.
  const buildData = {
    ...mesmerAppAdapter.profession.createBuildDefaults(),
    weapons: ['Staff', ''],
    alternateWeapons: ['Axe', 'Torch'],
    startingWeaponSet: 1,
    specializations: [
      { name: 'Dueling', traits: '1-1-1' },
      { name: 'Illusions', traits: '1-1-1' },
      { name: 'Mirage', traits: '1-1-1' }
    ]
  };
  const payloads = new Map([
    ['data/gw2/builds/mesmer/ambiguous-mirage.json', buildData],
    ['data/gw2/rotations/mesmer/ambiguous-mirage.json', { rotation: [{ name: 'Swap Weapons' }, { skillId: 45243 }] }]
  ]);

  t.mock.method(globalThis, 'fetch', async (url) => {
    const payload = payloads.get(String(url).split('?')[0]);
    return {
      ok: payload !== undefined,
      json: async () => structuredClone(payload)
    };
  });
  const app = {
    ...createApp(),
    adapter: mesmerAppAdapter,
    profession: mesmerAppAdapter.profession,
    activeCatalog: mesmerAppAdapter.profession.catalog,
    build: mesmerAppAdapter.toApplicationBuild(buildData),
    attributeWeaponSet: 1,
    analysis: {
      needsPatchComparison: () => false,
      state: {
        buildRevision: 0,
        resultRevision: 0,
        simulationStatus: 'idle',
        simulationError: '',
        patchComparison: null,
        results: null
      }
    },
    patch: mesmerAppAdapter.profession.resolvePatch({ id: 'current' })
  };

  await loadTemplateAction(
    app,
    {
      section: 'Mirage',
      label: 'Condition - Dune Cloak',
      build: 'data/gw2/builds/mesmer/ambiguous-mirage.json',
      rotation: 'data/gw2/rotations/mesmer/ambiguous-mirage.json'
    },
    'template'
  );
  app.attributeData = mesmerAppAdapter
    .createBuildContext({
      build: app.build,
      transitionDelays: normalizeTransitionDelays(app.simulationSettings?.transitionDelays),
      patch: mesmerAppAdapter.profession.resolvePatch({ id: app.patch.id ?? 'current' })
    })
    .attributes(app.attributeWeaponSet === 2 ? 2 : 1);
  const result = simulateGw2({
    profession: mesmerAppAdapter.profession,
    rotation: app.build.rotation,
    config: mesmerAppAdapter
      .createBuildContext({
        build: app.build,
        transitionDelays: normalizeTransitionDelays(app.simulationSettings?.transitionDelays),
        patch: mesmerAppAdapter.profession.resolvePatch({ id: app.patch.id ?? 'current' })
      })
      .simulationConfig()
  });

  assert.equal(app.build.rotation[1].skillId, MESMER_ID.LINGERING_THOUGHTS);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.steps[1].skillId, MESMER_ID.LINGERING_THOUGHTS);
});

// Rotation-only imports preserve the user's loadout while resolving protocols moved between F2 and F4.
test('Engineer rotation-only template loading resolves morph slots before simulation and supports undo', async (t) => {
  const adapter = engineerAppAdapter;
  const build = adapter.toApplicationBuild({
    ...adapter.profession.createBuildDefaults(),
    specializations: [
      { name: 'Explosives', traits: '3-2-3' },
      { name: 'Inventions', traits: '1-2-3' },
      { name: 'Amalgam', traits: '3-2-1' }
    ],
    selectedMorphSkillIds: [76806, 77104, 76954]
  });
  const original = structuredClone(build);
  t.mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    json: async () => ({
      rotation: [
        { type: 'cast', skillId: 76927 },
        { type: 'cast', skillId: 76705 }
      ]
    })
  }));
  const app = {
    ...createApp(),
    adapter,
    profession: adapter.profession,
    activeCatalog: adapter.profession.catalog,
    build,
    attributeWeaponSet: 1,
    analysis: {
      needsPatchComparison: () => false,
      state: {
        buildRevision: 0,
        resultRevision: 0,
        simulationStatus: 'idle',
        simulationError: '',
        patchComparison: null,
        results: null
      }
    },
    patch: adapter.profession.resolvePatch({ id: 'current' })
  };
  await loadTemplateAction(app, { label: 'Morph rotation', rotation: 'rotation.json' }, 'rotation');
  assert.deepEqual(app.build, {
    ...original,
    rotation: [
      { type: 'cast', skillId: 76954 },
      { type: 'cast', skillId: 76806 }
    ]
  });
  app.attributeData = adapter
    .createBuildContext({
      build: app.build,
      transitionDelays: normalizeTransitionDelays(app.simulationSettings?.transitionDelays),
      patch: adapter.profession.resolvePatch({ id: app.patch.id ?? 'current' })
    })
    .attributes(app.attributeWeaponSet === 2 ? 2 : 1);
  const result = simulateGw2({
    profession: adapter.profession,
    rotation: app.build.rotation,
    config: adapter
      .createBuildContext({
        build: app.build,
        transitionDelays: normalizeTransitionDelays(app.simulationSettings?.transitionDelays),
        patch: adapter.profession.resolvePatch({ id: app.patch.id ?? 'current' })
      })
      .simulationConfig()
  });
  assert.deepEqual(result.warnings, []);
  assert.ok(result.totalDamage > 0);
  undoTemplateLoad(app);
  assert.deepEqual(app.build, original);
});

test('a complete template without a rotation clears stale rotation state', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    json: async () => ({
      profession: 'mesmer',
      marker: 'build-only-template'
    })
  }));
  const app = createApp();

  await loadTemplateAction(
    app,
    {
      section: 'Mirage',
      label: 'Power',
      build: 'data/gw2/builds/mesmer/build-only.json'
    },
    'template'
  );

  assert.equal(app.build.marker, 'build-only-template');
  assert.deepEqual(app.build.rotation, []);
});

// Boss loading starts an empty rotation without fetching repository rotations; Undo restores the prior work.
test('boss manifest selections fetch only the build and clear the rotation with undo support', async (t) => {
  const requested = [];
  t.mock.method(globalThis, 'fetch', async (url) => {
    requested.push(String(url).split('?')[0]);
    return {
      ok: true,
      json: async () => ({ profession: 'mesmer', marker: 'downloaded', rotation: [{ type: 'wait', durationMs: 800 }] })
    };
  });
  const preset = { label: 'Power', build: 'boss-build.json', rotation: 'repository-rotation.json' };
  for (const rotation of [[], [{ type: 'wait', durationMs: 1200 }]]) {
    for (const action of ['template', 'build', 'rotation', 'new-tab']) {
      const app = createApp();
      app.build.rotation = structuredClone(rotation);
      app.workspace = { scenario: {}, tabs: [], persist() {} };
      requested.length = 0;
      await loadTemplateAction(app, preset, action);
      assert.deepEqual(requested, [preset.build]);
      assert.equal(app.build.marker, 'downloaded');
      assert.deepEqual(app.build.rotation, []);
      assert.equal(app.workspace.tabs.length, 0);
      undoTemplateLoad(app);
      assert.equal(app.build.marker, 'current');
      assert.deepEqual(app.build.rotation, rotation);
    }
  }
});

// A superseded request must neither replace the build nor report an error.
test('superseded template success and failure leave the latest request and its progress intact', async (t) => {
  for (const fails of [false, true]) {
    const first = Promise.withResolvers();
    const second = Promise.withResolvers();
    t.mock.method(globalThis, 'fetch', (url) => (String(url).startsWith('first') ? first.promise : second.promise));
    const app = createApp();
    const oldLoad = loadTemplateAction(app, { label: 'First', build: 'first.json' }, 'template');
    const newLoad = loadTemplateAction(app, { label: 'Second', build: 'second.json' }, 'template');
    const request = app.libraryLoad;
    const progress = app.templateRotationLoading;

    if (fails) first.reject(new Error('Obsolete failure must not alert'));
    else first.resolve({ ok: true, json: async () => ({ profession: 'mesmer', marker: 'first' }) });

    await oldLoad;
    assert.equal(app.libraryLoad, request);
    assert.equal(app.templateRotationLoading, progress);
    assert.equal(app.build.marker, 'current');
    second.resolve({ ok: true, json: async () => ({ profession: 'mesmer', marker: 'second' }) });
    await newLoad;
    assert.equal(app.build.marker, 'second');
    assert.equal(app.libraryLoad, undefined);
    assert.equal(app.templateUndo.build.marker, 'current');
    assert.equal(app.changedCalls.length, 1);
  }
});

test('a late template cannot overwrite a newer template or My Builds selection', async (t) => {
  for (const source of ['template', 'mine']) {
    const first = Promise.withResolvers();
    t.mock.method(globalThis, 'fetch', async (url) =>
      String(url).startsWith('first')
        ? first.promise
        : {
            ok: true,
            json: async () => ({ profession: 'mesmer', marker: 'second' })
          }
    );
    const app = createApp();
    const oldLoad = loadTemplateAction(app, { label: 'First', build: 'first.json' }, 'template');

    if (source === 'template') await loadTemplateAction(app, { label: 'Second', build: 'second.json' }, 'template');
    else loadMyBuildEntry(app, { name: 'Mine', build: { ...app.build, marker: 'second' } });

    first.resolve({ ok: true, json: async () => ({ profession: 'mesmer', marker: 'first' }) });
    await oldLoad;
    assert.equal(app.build.marker, 'second');
    assert.equal(app.changedCalls.length, 1);
    assert.equal(app.libraryLoad, undefined);
    undoTemplateLoad(app);
    assert.equal(app.build.marker, 'current');
  }
});

// Undo must immediately invalidate pending loads, including those that would create a separate tab.
test('library Undo supersedes pending downloads and ignores their late success or failure', async (t) => {
  for (const action of ['template', 'new-tab']) {
    for (const fails of [false, true]) {
      const ready = Promise.withResolvers();
      t.mock.method(globalThis, 'fetch', () => ready.promise);
      const app = createApp();
      const original = structuredClone(app.build);
      loadMyBuildEntry(app, { name: 'Mine', build: { ...app.build, marker: 'saved' } });
      const loading = loadTemplateAction(app, { label: 'Pending', build: 'pending.json' }, action);
      undoTemplateLoad(app);
      assert.deepEqual(app.build, original);
      assert.equal(app.libraryLoad, undefined);
      assert.equal(app.templateRotationLoading, undefined);
      assert.equal(app.templateUndo, null);

      if (fails) ready.reject(new Error('Cancelled download'));
      else ready.resolve({ ok: true, json: async () => ({ profession: 'mesmer', marker: 'late' }) });

      await loading;
      assert.deepEqual(app.build, original);
      assert.equal(app.changedCalls.length, 2);
    }
  }
});

test('headless template loads reject edits and destination changes before installing metadata', async (t) => {
  for (const change of ['edit', 'workspace', 'tab', 'patch']) {
    for (const action of ['template', 'new-tab']) {
      if (change === 'edit' && action === 'new-tab') continue;

      const ready = Promise.withResolvers();
      t.mock.method(globalThis, 'fetch', () => ready.promise);
      const app = createApp();
      app.workspace = { activeTabId: 'original', tabs: [] };
      const request = beginLibraryLoad(app, action);
      const loading = loadLibraryTemplate(app, request, { label: 'Example', build: 'build.json' });

      if (change === 'edit') app.analysis.state.buildRevision++;

      if (change === 'workspace') app.workspace = { ...app.workspace };

      if (change === 'tab') app.workspace.activeTabId = 'other';

      if (change === 'patch') app.patch = { ...app.patch, id: 'other' };

      ready.resolve({ ok: true, json: async () => ({ profession: 'mesmer', marker: 'downloaded' }) });
      await assert.rejects(loading, /build changed while loading/);
      assert.equal(app.build.marker, 'current');
      assert.equal(app.templateUndo, null);
      assert.equal(app.currentTemplate, null);
      assert.equal(app.changedCalls.length, 0);
      assert.equal(app.workspace.tabs.length, 0);
    }
  }
});

test('a malformed paired rotation leaves the build and library metadata untouched', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => ({
    ok: true,
    json: async () => (String(url).startsWith('rotation') ? {} : { profession: 'mesmer', marker: 'downloaded' })
  }));
  const app = createApp();
  const request = beginLibraryLoad(app, 'template');
  await assert.rejects(
    loadLibraryTemplate(app, request, {
      label: 'Example',
      build: 'build.json',
      rotation: 'rotation.json'
    }),
    /Rotation array missing/
  );
  assert.equal(app.build.marker, 'current');
  assert.equal(app.templateUndo, null);
  assert.equal(app.changedCalls.length, 0);
});
