import test from 'node:test';
import { runGw2Runtime } from '#gw2/platform/simulation/runtime.js';

import { assertManifestRegressions } from './preset-benchmark.js';

// Audit the converted family directly until the common application entry cuts over in phase 6.
test('Necromancer presets load and stay within 1% DPS', () =>
  assertManifestRegressions('necromancer', (adapter, rotation, config) =>
    runGw2Runtime({ profession: adapter.profession.liveRuntimeFor(config), config, rotation })
  ));
