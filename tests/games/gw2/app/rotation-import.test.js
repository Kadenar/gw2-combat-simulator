import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyRotationImportPreview,
  previewManifestRotation,
  previewRotationFile
} from '#gw2/app/import-export/rotation-import-dialog.js';
import { mesmerAppAdapter as adapter } from '#gw2/professions/mesmer/app/app-definition.js';
import { setRotationReference } from '#gw2/app/rotation/comparison-state.js';
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
  return { adapter, build, activeCatalog: adapter.profession.catalog, changed() {} };
}

const sources = {
  file: async (_t, items, app) =>
    previewRotationFile(new File([JSON.stringify({ rotation: items })], 'rotation.json'), app),
  manifest: async (t, items, app) => {
    t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ rotation: items })));
    return previewManifestRotation({ rotation: '/fixture.json', label: 'Fixture' }, app);
  }
};

for (const [source, preview] of Object.entries(sources)) {
  // Name collisions must use the selected elite without changing the build or rotation before Apply.
  test(`${source} rotation preview resolves names for the selected specialization`, async (t) => {
    for (const [line, items, ids] of [
      ['Virtuoso', ['Bladecall'], [69311]],
      ['Mirage', ['Axes of Symmetry', 'Lingering Thoughts'], [43761, 45243]],
      ['Chaos', ['Bladecall'], [62560]],
      ['Troubadour', ['Lively Lute', 'Harmonious Harp'], [76552, 77077]]
    ]) {
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
      { name: 'Bladecall', offset: 50, impactDelayMs: 200 },
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
      [{ name: 'Bladecall', interruptMs: -1 }, /Interrupt duration must be a non-negative number/],
      [{ name: 'Bladecall', releaseDelayMs: 0 }, /only Dragon Slash casts may contain releaseDelayMs/],
      [{ name: 'Bladecall', offTarget: true, impactDelayMs: 1 }, /off-target casts cannot contain impactDelayMs/],
      [{ type: 'wait', durationMs: -1 }, /wait commands require a non-negative durationMs/],
      [{ type: 'invalid' }, /invalid canonical command/]
    ]) {
      await assert.rejects(preview(t, ['Bladecall', entry], app), message);
      assert.deepEqual(app.build, original);
    }
  });
}

test('rotation previews preserve explicit commands that saved-build migration would remove', async (t) => {
  const app = {
    adapter: rangerAppAdapter,
    activeCatalog: rangerAppAdapter.profession.catalog,
    build: rangerAppAdapter.toApplicationBuild(rangerAppAdapter.profession.createBuildDefaults())
  };
  const rotation = [{ type: 'cast', skillId: RANGER_SKILL_IDS.OVERBEARING_SMASH_SECOND_STRIKE }];
  const preview = await sources.file(t, rotation, app);
  assert.deepEqual(preview.rotation, rotation);
});

// Validate skill-dependent metadata after selected-name resolution, using the active patch's skill definitions.
test('strict preview validation uses the selected identity and active patch catalog', async (t) => {
  const app = appFor();
  const skillsById = new Map(app.activeCatalog.skillsById);
  skillsById.set(69311, { ...skillsById.get(69311), dragonSlash: true });
  app.activeCatalog = { ...app.activeCatalog, skillsById };
  const preview = await sources.file(t, [{ name: 'Bladecall', releaseDelayMs: 100 }], app);
  assert.deepEqual(preview.rotation, [{ type: 'cast', skillId: 69311, releaseDelayMs: 100 }]);
});

test('selected identities reach both Current and Reference without mutating the preview', async (t) => {
  const app = appFor();
  const preview = await sources.file(t, ['Bladecall'], app);
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
