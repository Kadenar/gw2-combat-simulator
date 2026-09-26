import test from 'node:test';
import { runGw2Runtime } from '#gw2/platform/simulation/runtime.js';

import { assertManifestRegressions } from './preset-benchmark.js';

// Preset loading keeps the unchanged manifest gate while exercising the registered live family.
test('Ranger presets load and stay within 1% DPS', () =>
  assertManifestRegressions('ranger', (adapter, rotation, config) =>
    runGw2Runtime({ profession: adapter.profession.runtimeFor(config), rotation, config })
  ));
