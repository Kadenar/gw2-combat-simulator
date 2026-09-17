// Shared driver for the per-profession benchmark suites in this folder.
//
// Each profession has its own `<profession>.test.js` file so a drift or crash
// in one profession's presets never prevents another profession's regressions
// from running. They all funnel through `assertManifestRegressions`, which walks
// a profession's `data/gw2/builds/<profession>/manifest.json`, loads every saved build
// and rotation through the shared app shell, and verifies warning-free, stable
// DPS results without pinning rotation composition or EVTC details.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { loadProfessionAppAdapter } from '#gw2/app/profession-registry.js';

const repoUrl = (path) => new URL(`../../../../${path}`, import.meta.url);

export function relativeError(actual, expected) {
  return Math.abs(actual / expected - 1);
}

export async function assertManifestRegressions(professionId) {
  const manifest = JSON.parse(await readFile(repoUrl(`data/gw2/builds/${professionId}/manifest.json`), 'utf8'));
  const adapter = await loadProfessionAppAdapter(professionId);

  assert.ok(adapter, `${professionId} has no native app adapter`);
  assert.ok(
    manifest.some((section) => section.presets.length > 0),
    `${professionId} has no presets`
  );
  // Validate asset ownership while loading so a second suite need not reread every preset.
  const readAsset = async (path, kind) => {
    const url = repoUrl(path);
    assert.ok(url.href.startsWith(repoUrl(`data/gw2/${kind}/${professionId}/`).href), path);
    return JSON.parse(await readFile(url, 'utf8'));
  };

  const mismatches = [];
  const unexpectedWarnings = [];

  for (const section of manifest) {
    for (const preset of section.presets) {
      const label = `${professionId}: ${section.section} ${preset.label}`;

      assert.ok(Number.isFinite(preset.benchmarkDps) && preset.benchmarkDps > 0, label);

      const [savedBuild, savedRotation] = await Promise.all([
        readAsset(preset.build, 'builds'),
        preset.rotation ? readAsset(preset.rotation, 'rotations') : null
      ]);
      assert.equal(savedBuild.profession, professionId, label);
      assert.ok(Number.isInteger(savedBuild.schemaVersion) && savedBuild.schemaVersion > 0, label);
      const rotation = preset.rotation ? (savedRotation?.rotation ?? savedRotation) : (savedBuild.rotation ?? []);
      assert.ok(Array.isArray(rotation), label);
      if (preset.rotation) assert.ok(rotation.length > 0, label);
      const build = adapter.toApplicationBuild({
        ...savedBuild,
        rotation
      });
      // The app object mirrors the real shell: `adapter` exposes the assumption
      // controls (e.g. the shared `permanentComboField` testing assumption) and
      // `profession` backs the slot-loadout skill resolution used by config building.
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
      // Build-only presets still exercise loading and configuration without inventing a benchmark rotation.
      if (!preset.rotation) continue;
      const result = adapter.simulateBuild(build.rotation, config);
      const dpsError = relativeError(result.dps, preset.benchmarkDps);

      if (result.warnings.length) unexpectedWarnings.push({ label, warnings: result.warnings });
      if (!Number.isFinite(result.dps) || dpsError > 0.01) {
        mismatches.push({
          label,
          expectedDps: preset.benchmarkDps,
          actualDps: result.dps,
          relativeError: dpsError
        });
      }
    }
  }

  assert.deepEqual(unexpectedWarnings, [], `${professionId} preset warnings`);
  assert.deepEqual(mismatches, [], `${professionId} preset regression`);
}
