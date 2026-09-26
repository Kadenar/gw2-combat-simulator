import test from 'node:test';
import { runGw2Runtime } from '#gw2/platform/simulation/runtime.js';

import { assertManifestRegressions } from './preset-benchmark.js';

// Loading stays shared while the DPS gate exercises the migrated Elementalist owners.
test('Elementalist presets load and stay within 1% DPS', () =>
  assertManifestRegressions('elementalist', (adapter, rotation, config) =>
    runGw2Runtime({ profession: adapter.profession.liveRuntimeFor(config), rotation, config })
  ));
