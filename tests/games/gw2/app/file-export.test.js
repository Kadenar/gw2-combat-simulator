import assert from 'node:assert/strict';
import test from 'node:test';
import {
  jsonExportFilename,
  getBuildExportPayload,
  getBuildWithRotationExportPayload
} from '#gw2/app/import-export/files.js';
import { getRotationItems } from '#gw2/integrations/assets.js';
import { createDefaultBuild, replaceBuildConfiguration } from '#gw2/app/build/state/persistence.js';
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

  const exported = getBuildWithRotationExportPayload(build);
  exported.rotation.push('Mutating the export');

  assert.deepEqual(build.rotation, ['Keep this rotation']);
  assert.deepEqual(getRotationItems(exported), ['Keep this rotation', 'Mutating the export']);
  assert.equal(replaceBuildConfiguration(exported, createDefaultBuild(adapter), adapter).rune, 'Krait');
});
