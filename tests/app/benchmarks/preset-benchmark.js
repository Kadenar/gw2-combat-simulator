// Shared driver for the per-profession benchmark suites in this folder.
//
// Each profession has its own `<profession>.test.js` file so a drift or crash
// in one profession's presets never prevents another profession's regressions
// from running. They all funnel through `assertManifestRegressions`, which walks
// a profession's `Builds/<profession>/manifest.json`, loads every saved build
// and rotation through the shared app shell, and verifies a stable DPS result
// without pinning rotation composition or EVTC details.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { loadProfessionAppAdapter } from '../../../js/app/profession/registry.js';

const repoUrl = (path) => new URL(`../../../${path}`, import.meta.url);

export function relativeError(actual, expected) {
  return Math.abs(actual / expected - 1);
}

export async function assertManifestRegressions(professionId) {
  const manifest = JSON.parse(await readFile(repoUrl(`Builds/${professionId}/manifest.json`), 'utf8'));
  const adapter = await loadProfessionAppAdapter(professionId);

  assert.ok(adapter, `${professionId} has no native app adapter`);
  const mismatches = [];

  for (const section of manifest) {
    for (const preset of section.presets) {
      const label = `${professionId}: ${section.section} ${preset.label}`;

      assert.ok(Number.isFinite(preset.benchmarkDps) && preset.benchmarkDps > 0, label);

      if (!preset.rotation) continue;

      const [savedBuild, savedRotation] = await Promise.all([
        readFile(repoUrl(preset.build), 'utf8').then(JSON.parse),
        readFile(repoUrl(preset.rotation), 'utf8').then(JSON.parse)
      ]);
      const build = adapter.toApplicationBuild({
        ...savedBuild,
        rotation: savedRotation.rotation ?? savedRotation
      });
      // The app object mirrors the real shell: `adapter` exposes the assumption
      // controls (e.g. reaper `permanentIceField`) and `profession` backs the
      // slot-loadout skill resolution used by config building.
      const app = {
        build,
        adapter,
        profession: adapter.profession,
        skillByName: adapter.profession.catalog.skillsByName,
        skillById: adapter.profession.catalog.skillsById,
        attributeWeaponSet: 1
      };

      adapter.recalculate(app);
      const config = adapter.simulationConfig(app);
      const result = adapter.simulateBuild(build.rotation, config);
      const dpsError = relativeError(result.dps, preset.benchmarkDps);

      if (dpsError > 0.01) {
        mismatches.push({
          label,
          expectedDps: preset.benchmarkDps,
          actualDps: result.dps,
          relativeError: dpsError
        });
      }
    }
  }

  assert.deepEqual(mismatches, [], `${professionId} preset regression`);
}
