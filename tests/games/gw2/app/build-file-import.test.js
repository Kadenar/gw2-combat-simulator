import assert from 'node:assert/strict';
import test from 'node:test';

import { createDefaultBuild } from '#gw2/app/build/state/persistence.js';
import { applyBuildFileImport, previewBuildFileImport } from '#gw2/app/import-export/build-file-import.js';
import { getBuildExportPayload, getBuildWithRotationExportPayload } from '#gw2/app/import-export/files.js';
import { loadManifestBuilds } from '#gw2/app/import-export/rotation-import-dialog.js';
import { loadProfessionAppAdapter } from '#tests/helpers/profession-app-adapter.js';

test('build file import detects which parts a file carries', async () => {
  const adapter = await loadProfessionAppAdapter('mesmer');
  const source = createDefaultBuild(adapter);
  const skill = Object.values(source.selectedSkillIds).find(Boolean);
  const app = {
    patch: adapter.profession.resolvePatch({ id: 'current' }),
    adapter,
    build: createDefaultBuild(adapter),
    changed() {}
  };

  const combined = previewBuildFileImport(
    getBuildWithRotationExportPayload({ ...source, rotation: [skill] }),
    'combined.json',
    app
  );
  const buildOnly = previewBuildFileImport(getBuildExportPayload(source), 'build.json', app);
  const wrapped = previewBuildFileImport({ rotation: [skill] }, 'rotation.json', app);
  const bare = previewBuildFileImport([skill], 'rotation.json', app);

  assert.notEqual(combined.build, null);
  assert.equal(combined.rotation.length, 1);
  assert.notEqual(buildOnly.build, null);
  assert.equal(buildOnly.rotation, null);
  assert.equal(wrapped.build, null);
  assert.equal(wrapped.rotation.length, 1);
  assert.equal(bare.build, null);
  assert.throws(() => previewBuildFileImport({}, 'empty.json', app), /No build or rotation/);
  assert.throws(() => previewBuildFileImport({ rotation: [] }, 'empty.json', app), /No build or rotation/);
  // Unrelated JSON must not import as a default build that would silently reset the current one.
  assert.throws(
    () => previewBuildFileImport({ players: [], phases: [], skillMap: {} }, 'report.json', app),
    /No build or rotation/
  );
  const versioned = previewBuildFileImport({ version: 1, rotation: [skill] }, 'rotation.json', app);
  assert.equal(versioned.build, null);
  assert.equal(versioned.rotation.length, 1);
  assert.throws(
    () => previewBuildFileImport({ ...source, profession: 'necromancer' }, 'other.json', app),
    /necromancer/
  );
});

test('build file import clears the template highlight but keeps the tab reset target', async () => {
  const adapter = await loadProfessionAppAdapter('mesmer');
  const source = { ...createDefaultBuild(adapter), rune: 'Krait' };
  const skill = Object.values(source.selectedSkillIds).find(Boolean);
  const templateBuild = createDefaultBuild(adapter);
  const tab = { id: 'tab', templateBuild };
  const app = {
    patch: adapter.profession.resolvePatch({ id: 'current' }),
    adapter,
    build: createDefaultBuild(adapter),
    changed() {},
    currentTemplate: { build: 'template.json', signature: '' },
    workspace: { tabs: [tab], activeTabId: 'tab' }
  };

  const rotationFile = getBuildWithRotationExportPayload({ ...source, rotation: [skill] });
  applyBuildFileImport(app, previewBuildFileImport(rotationFile, 'combined.json', app), {
    build: false,
    rotation: true
  });
  assert.notEqual(app.currentTemplate, null);

  applyBuildFileImport(app, previewBuildFileImport(getBuildExportPayload(source), 'build.json', app), {
    build: true,
    rotation: false
  });
  assert.equal(app.build.rune, 'Krait');
  assert.equal(app.currentTemplate, null);
  // Reset after an import returns to the tab's loaded baseline, not the imported file.
  assert.equal(tab.templateBuild, templateBuild);
});

test('reference rotation manifest builds load lazily once per template list', async () => {
  const presets = [
    { label: 'A', build: 'a.json', rotation: 'ra.json' },
    { label: 'B', build: 'b.json' },
    { label: 'C', build: 'c.json', rotation: 'rc.json' }
  ];
  const fetched = [];
  let offline = true;
  const fetchAsset = async (path) => {
    fetched.push(path);

    if (offline && path === 'c.json') throw new Error('Could not load c.json');

    return { path };
  };

  const builds = (entries) => entries.map((entry) => entry?.build ?? null);

  const failed = await loadManifestBuilds(presets, fetchAsset);
  assert.deepEqual(fetched, ['a.json', 'c.json']);
  assert.deepEqual(builds(failed), [{ path: 'a.json' }, null]);

  // A failed fetch may be a network blip, so the next open retries instead of reusing the failure.
  offline = false;
  const retried = await loadManifestBuilds(presets, fetchAsset);
  assert.deepEqual(builds(retried), [{ path: 'a.json' }, { path: 'c.json' }]);
  assert.equal(await loadManifestBuilds(presets, fetchAsset), retried);
  assert.equal(fetched.length, 4);

  // Re-rendered templates produce a new list, which loads fresh.
  await loadManifestBuilds([...presets], fetchAsset);
  assert.equal(fetched.length, 6);
});

test('build file import applies only the selected parts', async () => {
  const adapter = await loadProfessionAppAdapter('mesmer');
  const source = createDefaultBuild(adapter);
  const skill = Object.values(source.selectedSkillIds).find(Boolean);
  const exported = getBuildWithRotationExportPayload({ ...source, rune: 'Krait', rotation: [skill] });
  const importInto = (selection) => {
    const calls = [];
    const app = {
      patch: adapter.profession.resolvePatch({ id: 'current' }),
      adapter,
      build: createDefaultBuild(adapter),
      changed: (rebuild = true) => calls.push(rebuild)
    };
    const originalRune = app.build.rune;
    applyBuildFileImport(app, previewBuildFileImport(exported, 'combined.json', app), selection);
    return { build: app.build, calls, originalRune };
  };

  const both = importInto({ build: true, rotation: true });
  assert.equal(both.build.rune, 'Krait');
  assert.equal(both.build.rotation.length, 1);
  assert.deepEqual(both.calls, [true]);

  const buildOnly = importInto({ build: true, rotation: false });
  assert.equal(buildOnly.build.rune, 'Krait');
  assert.equal(buildOnly.build.rotation.length, 0);
  assert.deepEqual(buildOnly.calls, [true]);

  const rotationOnly = importInto({ build: false, rotation: true });
  assert.equal(rotationOnly.build.rune, rotationOnly.originalRune);
  assert.equal(rotationOnly.build.rotation.length, 1);
  assert.deepEqual(rotationOnly.calls, [false]);

  assert.throws(() => importInto({ build: false, rotation: false }), /Choose the build/);
});
