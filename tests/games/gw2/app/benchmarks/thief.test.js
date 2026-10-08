import test from 'node:test';

import { runGw2Runtime } from '#gw2/platform/simulation/runtime.js';
import { assertManifestRegressions } from './preset-benchmark.js';

// Load every saved Thief preset and require warning-free replay within 1% of its manifest DPS.
test('Thief presets load and stay within 1% DPS', () =>
  assertManifestRegressions('thief', (adapter, rotation, config) =>
    runGw2Runtime({ profession: adapter.profession.runtimeFor(config), config, rotation })
  ));
