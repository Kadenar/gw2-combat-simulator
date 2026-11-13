import assert from 'node:assert/strict';
import test from 'node:test';

import { runGw2Runtime } from '#gw2/platform/simulation/runtime.js';

import { assertManifestRegressions } from './preset-benchmark.js';

// Loading stays shared while the DPS gate exercises the migrated Elementalist owners.
test('Elementalist presets load and stay within 1% DPS', () =>
  assertManifestRegressions('elementalist', (adapter, rotation, config) => {
    const simulate = (config) => runGw2Runtime({ profession: adapter.profession.runtimeFor(config), rotation, config });
    const result = simulate(config);

    if (!result.warnings.length) return result;

    // Faster kills stop Catalyst energy gains before the saved rotation's remaining spheres.
    // Reject every in-combat warning, then validate the entire unchanged rotation with a surviving target.
    for (const warning of result.warnings)
      assert.ok(result.deathTime != null && warning.at > result.deathTime, warning.message);

    const survivingTarget = simulate({ ...config, target: { ...config.target, health: 0 } });
    return { ...result, warnings: survivingTarget.warnings };
  }));
