import test from 'node:test';
import { runGw2Runtime } from '#gw2/platform/simulation/runtime.js';
import { assertManifestRegressions } from './preset-benchmark.js';

// Exercise the registered live family until the shared application entry cuts over in phase 6.
test('Guardian presets load and stay within 1% DPS', () =>
  assertManifestRegressions('guardian', (adapter, rotation, config) =>
    runGw2Runtime({ profession: adapter.profession.liveRuntimeFor(config), config, rotation })
  ));
