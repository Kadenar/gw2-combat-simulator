import assert from 'node:assert/strict';
import test from 'node:test';

import { applyBuildFileImport, previewBuildFileImport } from '#gw2/app/import-export/build-file-import.js';
import { getBuildWithRotationExportPayload } from '#gw2/app/import-export/files.js';
import {
  applyRotationImportPreview,
  previewManifestRotation,
  previewRotationFile
} from '#gw2/app/import-export/rotation-import-dialog.js';
import { setRotationReference } from '#gw2/app/rotation/comparison-state.js';
import { recordRotationHistory, redoRotation, undoRotation } from '#gw2/app/rotation/editing/history.js';
import { normalizeTransitionDelays } from '#gw2/platform/execution/transition-lockouts.js';
import { mesmerAppAdapter as adapter } from '#gw2/professions/mesmer/app/app-definition.js';
import { rangerAppAdapter } from '#gw2/professions/ranger/app/app-definition.js';
import { RANGER_SKILL_IDS } from '#gw2/professions/ranger/data/ids.js';

// Keep file and fetch boundaries inert while exercising the same strict previews used by the dialog.
test.beforeEach((t) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'FileReader');
  Object.defineProperty(globalThis, 'FileReader', {
    configurable: true,
    value: class {
      async readAsText(file) {
        this.result = await file.text();
        this.onload();
      }
    }
  });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'FileReader', previous);
    else delete globalThis.FileReader;
  });
});

function appFor(line = 'Virtuoso') {
  const build = adapter.toApplicationBuild(adapter.profession.createBuildDefaults());
  build.specializations[2] = { name: line, traits: '1-1-1' };
  return {
    patch: adapter.profession.resolvePatch(),
    adapter,
    build,
    activeCatalog: adapter.profession.catalog,
    changed() {}
  };
}

// Both entry points honor the same exported settings; rotation history intentionally leaves workspace preferences alone.
test('combined exports import identical delays through either dialog and Undo preserves the imported settings', async () => {
  for (const useBuildImport of [false, true]) {
    for (const delay of [0, 150]) {
      const app = appFor();
      app.build.rotation = [{ type: 'wait', durationMs: 200 }];
      app.simulationSettings = { transitionDelays: normalizeTransitionDelays({ weaponSwapMs: 100 }) };
      app.changed = () => recordRotationHistory(app);
      recordRotationHistory(app);
      const rotation = [{ type: 'cast', skillId: 62617 }];
      const delays = normalizeTransitionDelays({ weaponSwapMs: delay });
      const payload = getBuildWithRotationExportPayload({ ...app.build, rotation }, delays);
      const file = new File([JSON.stringify(payload)], 'combined.json', { type: 'application/json' });
      const preview = useBuildImport
        ? previewBuildFileImport(payload, file.name, app)
        : await previewRotationFile(file, app);
      assert.equal(app.simulationSettings.transitionDelays.weaponSwapMs, 100);
      assert.deepEqual(preview.transitionDelays, delays);
      assert.ok(preview.warnings.some((notice) => notice.includes('every profession')));

      if (useBuildImport) applyBuildFileImport(app, preview, { build: false, rotation: true });
      else applyRotationImportPreview(app, preview);

      assert.deepEqual(app.build.rotation, rotation);
      assert.deepEqual(app.simulationSettings.transitionDelays, delays);
      undoRotation(app);
      assert.deepEqual(app.build.rotation, [{ type: 'wait', durationMs: 200 }]);
      assert.deepEqual(app.simulationSettings.transitionDelays, delays);
      redoRotation(app);
      assert.deepEqual(app.build.rotation, rotation);
      assert.deepEqual(app.simulationSettings.transitionDelays, delays);
      assert.deepEqual((await previewRotationFile(file, app)).warnings, []);
    }
  }
});

test('rotation upload rejects incomplete delay metadata without changing the rotation or workspace', async () => {
  const app = appFor();
  app.simulationSettings = { transitionDelays: normalizeTransitionDelays({ weaponSwapMs: 100 }) };
  const before = structuredClone(app.build);
  const file = new File([JSON.stringify({ rotation: [], transitionDelays: { weaponSwapMs: 0 } })], 'partial.json');
  await assert.rejects(previewRotationFile(file, app), /every delay/);
  assert.deepEqual(app.build, before);
  assert.equal(app.simulationSettings.transitionDelays.weaponSwapMs, 100);
});

const sources = {
  file: async (_t, items, app) =>
    previewRotationFile(new File([JSON.stringify({ rotation: items })], 'rotation.json'), app),
  manifest: async (t, items, app) => {
    t.mock.method(
      globalThis,
      'fetch',
      async (path) =>
        new Response(JSON.stringify(String(path).includes('build.json') ? app.build : { rotation: items }))
    );
    return previewManifestRotation({ build: '/build.json', rotation: '/fixture.json', label: 'Fixture' }, app);
  }
};

for (const [source, preview] of Object.entries(sources)) {
  // Explicit variants survive import without changing the build or rotation before Apply.
  test(`${source} rotation preview preserves IDs for the selected specialization`, async (t) => {
    for (const [line, ids] of [
      ['Virtuoso', [69311]],
      ['Mirage', [43761, 45243]],
      ['Chaos', [62560]],
      ['Troubadour', [76552, 77077]]
    ]) {
      const items = ids.map((skillId) => ({ type: 'cast', skillId }));
      const app = appFor(line);
      const original = structuredClone(app.build);
      const result = await preview(t, items, app);
      assert.deepEqual(
        result.rotation,
        ids.map((skillId) => ({ type: 'cast', skillId })),
        line
      );
      assert.deepEqual(app.build, original);
      assert.equal(result.actionCount, items.length);
    }
  });

  test(`${source} rotation preview preserves explicit identities and canonical command metadata`, async (t) => {
    const app = appFor();
    const items = [
      { type: 'cast', skillId: 62560, name: 'Bladecall', offTarget: true },
      { id: 69311, name: 'Other name', impactDelayMs: 500, offset: 100 },
      { skillId: 69311, offset: 50, impactDelayMs: 200 },
      { type: 'cast', skillId: 'unknown-skill' },
      { name: '__combat_start', offset: -100 },
      { name: '__wait', waitMs: 250 },
      { name: '__cooldown_reset' }
    ];
    const result = await preview(t, items, app);
    assert.deepEqual(result.rotation, [
      { type: 'cast', skillId: 62560, offTarget: true },
      { type: 'cast', skillId: 69311, impactDelayMs: 500, concurrentOffsetMs: 100 },
      { type: 'cast', skillId: 69311, impactDelayMs: 200, concurrentOffsetMs: 50 },
      { type: 'cast', skillId: 'unknown-skill' },
      { type: 'combat-start', concurrentOffsetMs: -100 },
      { type: 'wait', durationMs: 250 },
      { type: 'cooldown-reset' }
    ]);
  });

  // Invalid entries must report errors instead of disappearing through best-effort build migration.
  test(`${source} rotation preview rejects malformed fields`, async (t) => {
    const app = appFor();
    const original = structuredClone(app.build);
    for (const [entry, message] of [
      [{ skillId: 69311, interruptMs: -1 }, /Interrupt duration must be a non-negative number/],
      [{ skillId: 69311, releaseDelayMs: 0 }, /only Dragon Slash casts may contain releaseDelayMs/],
      [{ skillId: 69311, offTarget: true, impactDelayMs: 1 }, /off-target casts cannot contain impactDelayMs/],
      [{ type: 'wait', durationMs: -1 }, /wait commands require a non-negative durationMs/],
      [{ type: 'invalid' }, /invalid canonical command/]
    ]) {
      await assert.rejects(preview(t, [69311, entry], app), message);
      assert.deepEqual(app.build, original);
    }
  });
}

test('rotation previews preserve explicit commands that saved-build migration would remove', async (t) => {
  const app = {
    patch: rangerAppAdapter.profession.resolvePatch(),
    adapter: rangerAppAdapter,
    activeCatalog: rangerAppAdapter.profession.catalog,
    build: rangerAppAdapter.toApplicationBuild(rangerAppAdapter.profession.createBuildDefaults())
  };
  // Outside Untamed, saved-build migration drops autonomous pet attacks such as Twin Darts.
  const rotation = [{ type: 'cast', skillId: RANGER_SKILL_IDS.TWIN_DARTS }];
  const preview = await sources.file(t, rotation, app);
  assert.deepEqual(preview.rotation, rotation);
});

// The preview boundary rejects mismatches even when a caller bypasses the saved-rotation dropdown.
test('manifest preview rejects incompatible specialization and weapon sets before loading commands', async (t) => {
  const app = appFor();
  const original = structuredClone(app.build);
  const preset = { build: '/build.json', rotation: '/rotation.json', label: 'Fixture' };
  for (const changes of [
    { specializations: [...app.build.specializations.slice(0, 2), { name: 'Mirage', traits: '1-1-1' }] },
    { weapons: ['Staff', ''] },
    { alternateWeapons: ['Scepter', 'Focus'] }
  ]) {
    const fetched = [];
    t.mock.method(globalThis, 'fetch', async (path) => {
      fetched.push(path);
      return new Response(JSON.stringify({ ...app.build, ...changes }));
    });
    await assert.rejects(
      previewManifestRotation(preset, app),
      /must match your profession, specialization, equipped weapons/
    );
    assert.equal(fetched.length, 1);
    assert.deepEqual(app.build, original);
  }
});

// Validate skill-dependent metadata by explicit identity, using the active patch's skill definitions.
test('strict preview validation uses the selected identity and active patch catalog', async (t) => {
  const app = appFor();
  const skillsById = new Map(app.activeCatalog.skillsById);
  skillsById.set(69311, { ...skillsById.get(69311), dragonSlash: true });
  app.activeCatalog = { ...app.activeCatalog, skillsById };
  const preview = await sources.file(t, [{ skillId: 69311, releaseDelayMs: 100 }], app);
  assert.deepEqual(preview.rotation, [{ type: 'cast', skillId: 69311, releaseDelayMs: 100 }]);
});

test('selected identities reach both Current and Reference without mutating the preview', async (t) => {
  const app = appFor();
  const preview = await sources.file(t, [69311], app);
  app.rotationComparison = {
    referenceRotation: [],
    referenceResult: null,
    referenceStatus: 'empty',
    referenceError: ''
  };
  const current = app.build.rotation;
  assert.equal(setRotationReference(app, preview.rotation), true);
  assert.equal(app.build.rotation, current);
  assert.deepEqual(app.rotationComparison.referenceRotation, [{ type: 'cast', skillId: 69311 }]);
  applyRotationImportPreview(app, preview);
  assert.deepEqual(app.build.rotation, [{ type: 'cast', skillId: 69311 }]);
  assert.notEqual(app.build.rotation, preview.rotation);
  assert.notEqual(app.rotationComparison.referenceRotation, preview.rotation);
});
