// Current skill IDs keep preserved rotations runnable; numerical checks cover only total model DPS.
import assert from 'node:assert/strict';
import test from 'node:test';

import { simulateBenchmarkPreset } from '../../../../../scripts/analysis/capture-supported-build-metrics.mjs';
import { loadBenchmarkPresets } from '../../../../../scripts/lib/benchmark-presets.mjs';

test('Mesmer presets simulate without warnings and stay within 1% of their recorded model DPS', async () => {
  for await (const preset of loadBenchmarkPresets(['mesmer'])) {
    const { result } = simulateBenchmarkPreset(preset.adapter, preset.savedBuild, preset.savedRotation);
    assert.ok(Number.isFinite(result.dps), preset.identity.id);
    assert.ok(Math.abs(result.dps / preset.identity.benchmarkDps - 1) <= 0.01, preset.identity.id);

    assert.deepEqual(result.warnings, [], preset.identity.id);
  }
});
