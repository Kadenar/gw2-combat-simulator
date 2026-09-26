import test from 'node:test';
import { runGw2Runtime } from '#gw2/platform/simulation/runtime.js';

import { assertManifestRegressions } from './preset-benchmark.js';

// Preset loading stays shared while Mesmer exercises its migrated live owners.
test('Mesmer presets load and stay within 1% DPS', () =>
  assertManifestRegressions('mesmer', (adapter, rotation, config) =>
    runGw2Runtime({ profession: adapter.profession.runtimeFor(config), rotation, config })
  ));
