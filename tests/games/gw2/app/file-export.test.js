import assert from 'node:assert/strict';
import test from 'node:test';

import { createDefaultBuild, replaceBuildConfiguration } from '#gw2/app/build/state/persistence.js';
import {
  getBuildExportPayload,
  getBuildWithRotationExportPayload,
  getRotationExportPayload,
  jsonExportFilename
} from '#gw2/app/import-export/files.js';
import { getRotationItems } from '#gw2/integrations/assets.js';
import { normalizeTransitionDelays } from '#gw2/platform/execution/transition-lockouts.js';
import { loadProfessionAppAdapter } from '#tests/helpers/profession-app-adapter.js';

// Every export shares fallback, whitespace, and extension handling without requiring a browser download matrix.
test('JSON export names preserve defaults and existing extensions', () => {
  for (const [input, expected] of [
    ['', 'build.json'],
    ['   ', 'build.json'],
    ['  My build  ', 'My build.json'],
    ['My build.JSON', 'My build.JSON'],
    ['build.json', 'build.json'],
    ['build.txt', 'build.txt.json']
  ])
    assert.equal(jsonExportFilename(input, 'build.json'), expected);
});

test('build import and export leave rotation state separate', async () => {
  const adapter = await loadProfessionAppAdapter('mesmer');
  const current = createDefaultBuild(adapter);

  current.rotation = ['Keep this rotation'];
  const imported = {
    ...createDefaultBuild(adapter),
    rune: 'Krait',
    rotation: ['Do not import this rotation']
  };

  const loaded = replaceBuildConfiguration(imported, current, adapter);
  const exported = getBuildExportPayload(loaded);

  assert.deepEqual(loaded.rotation, ['Keep this rotation']);
  assert.equal(loaded.rune, 'Krait');
  assert.equal(Object.hasOwn(exported, 'rotation'), false);
  assert.deepEqual(current.rotation, ['Keep this rotation']);
});

test('build + rotation export stays readable by both importers', async () => {
  const adapter = await loadProfessionAppAdapter('mesmer');
  const build = { ...createDefaultBuild(adapter), rune: 'Krait', rotation: ['Keep this rotation'] };

  const exported = getBuildWithRotationExportPayload(build, normalizeTransitionDelays(null));
  exported.rotation.push('Mutating the export');

  assert.deepEqual(build.rotation, ['Keep this rotation']);
  assert.deepEqual(getRotationItems(exported), ['Keep this rotation', 'Mutating the export']);
  assert.equal(replaceBuildConfiguration(exported, createDefaultBuild(adapter), adapter).rune, 'Krait');
});

// Zero delays are an explicit portable setting, and every export is detached from its workspace preferences.
test('only exports containing a rotation carry its complete detached delay settings', async () => {
  const adapter = await loadProfessionAppAdapter('mesmer');
  const build = createDefaultBuild(adapter);
  assert.equal(Object.hasOwn(getBuildExportPayload(build), 'transitionDelays'), false);
  for (const exportRotation of [
    getRotationExportPayload,
    (rotation, delays) => getBuildWithRotationExportPayload({ ...build, rotation }, delays)
  ]) {
    const delays = normalizeTransitionDelays({ weaponSwapMs: 150 });
    const rotation = [{ type: 'wait', durationMs: 200 }];
    const exported = exportRotation(rotation, delays);
    assert.deepEqual(exported.transitionDelays, delays);
    exported.rotation[0].durationMs = 500;
    assert.equal(rotation[0].durationMs, 200);
    delays.weaponSwapMs = 500;
    assert.equal(exported.transitionDelays.weaponSwapMs, 150);
    assert.equal(Object.hasOwn(build, 'transitionDelays'), false);
    assert.deepEqual(
      exportRotation(rotation, normalizeTransitionDelays()).transitionDelays,
      normalizeTransitionDelays()
    );
    assert.deepEqual(exportRotation(rotation).transitionDelays, normalizeTransitionDelays());
  }
});
