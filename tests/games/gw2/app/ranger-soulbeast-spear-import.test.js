import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { normalizeTransitionDelays } from '#gw2/platform/execution/transition-lockouts.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { loadProfessionAppAdapter } from '#tests/helpers/profession-app-adapter.js';

test('Soulbeast spear diagnostic import loads and simulates with the requested equipment', async () => {
  const [savedBuild, savedRotation, adapter] = await Promise.all([
    readFile(
      new URL('../../../../data/gw2/builds/ranger/b-power-soulbeast-spear-axe.json', import.meta.url),
      'utf8'
    ).then(JSON.parse),
    readFile(
      new URL('../../../../data/gw2/rotations/ranger/r-power-soulbeast-spear-axe-evtc.json', import.meta.url),
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
    patch: adapter.profession.resolvePatch(),
    build,
    adapter,
    profession: adapter.profession,
    activeCatalog: adapter.profession.catalog,
    attributeWeaponSet: 1
  };
  app.attributeData = adapter
    .createBuildContext({
      build: app.build,
      transitionDelays: normalizeTransitionDelays(app.simulationSettings?.transitionDelays),
      patch: adapter.profession.resolvePatch({ id: app.patch.id ?? 'current' })
    })
    .attributes(app.attributeWeaponSet === 2 ? 2 : 1);
  const result = simulateGw2({
    profession: adapter.profession,
    rotation: build.rotation,
    config: adapter
      .createBuildContext({
        build: app.build,
        transitionDelays: normalizeTransitionDelays(app.simulationSettings?.transitionDelays),
        patch: adapter.profession.resolvePatch({ id: app.patch.id ?? 'current' })
      })
      .simulationConfig()
  });
  assert.ok(Number.isFinite(result.dps) && result.dps > 0);
  // The documented manual opener makes this saved replay valid; no simulator warnings are waived.
  assert.deepEqual(result.warnings, []);
});
