// Preserved pre-patch rotations retain narrowly scoped, documented equipment and mantra warnings.
import assert from 'node:assert/strict';
import test from 'node:test';

import { simulateBenchmarkPreset } from '../../../../../scripts/analysis/capture-supported-build-metrics.mjs';
import { loadBenchmarkPresets } from '../../../../../scripts/lib/benchmark-presets.mjs';

const pendingRotations = new Set([
  'data/gw2/builds/mesmer/b-power-chronomancer.json',
  'data/gw2/builds/mesmer/b-power-chronomancer-dagger-sword-spear.json',
  'data/gw2/builds/mesmer/b-power-virtuoso-spear-greatsword.json'
]);
const expectedWarnings = new Set([
  'Phantasmal Disenchanter: Phantasmal Disenchanter is unavailable - its required weapon is not equipped.',
  'Power Spike: Mantra of Pain is not active.'
]);

test('Mesmer presets retain scoped pending warnings and stay within 1% of their recorded model DPS', async (t) => {
  for await (const preset of loadBenchmarkPresets(['mesmer'])) {
    const { result } = simulateBenchmarkPreset(preset.adapter, preset.savedBuild, preset.savedRotation);
    assert.ok(Number.isFinite(result.dps), preset.identity.id);
    assert.ok(Math.abs(result.dps / preset.identity.benchmarkDps - 1) <= 0.01, preset.identity.id);

    if (pendingRotations.has(preset.identity.build)) {
      assert.equal(preset.identity.upToDate, false, preset.identity.id);
      assert.ok(result.warnings.length > 0, preset.identity.id);
      assert.ok(
        result.warnings.every((warning) => expectedWarnings.has(warning.message)),
        JSON.stringify(result.warnings)
      );
      t.diagnostic(
        `${preset.identity.id}: ${result.warnings.length} known warnings; rotation review pending in docs/PENDING-BALANCE-UPDATES.md.`
      );
    } else assert.deepEqual(result.warnings, [], preset.identity.id);
  }
});
