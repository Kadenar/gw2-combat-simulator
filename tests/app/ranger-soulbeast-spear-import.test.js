import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadProfessionAppAdapter } from '#gw2/app/profession/registry.js';

test('Soulbeast spear diagnostic import loads and simulates with the requested equipment', async () => {
  const [savedBuild, savedRotation, adapter] = await Promise.all([
    readFile(new URL('../../data/gw2/builds/ranger/b-power-soulbeast-spear-axe.json', import.meta.url), 'utf8').then(
      JSON.parse
    ),
    readFile(
      new URL('../../data/gw2/rotations/ranger/r-power-soulbeast-spear-axe-evtc.json', import.meta.url),
      'utf8'
    ).then(JSON.parse),
    loadProfessionAppAdapter('ranger')
  ]);
  const build = adapter.toApplicationBuild({ ...savedBuild, rotation: savedRotation.rotation });
  assert.deepEqual(build.weapons, ['Spear', '']);
  assert.deepEqual(build.alternateWeapons, ['Axe', 'Axe']);
  assert.deepEqual(build.weaponSigils, [
    ['Force', 'Impact'],
    ['Force', 'Impact']
  ]);
  const app = {
    build,
    adapter,
    profession: adapter.profession,
    skillByName: adapter.profession.catalog.skillsByName,
    skillById: adapter.profession.catalog.skillsById,
    attributeWeaponSet: 1
  };
  adapter.recalculate(app);
  const result = adapter.simulateBuild(build.rotation, adapter.simulationConfig(app));
  assert.ok(Number.isFinite(result.dps) && result.dps > 0);
  // The documented manual opener makes this saved replay valid; no simulator warnings are waived.
  assert.deepEqual(result.warnings, []);
});
