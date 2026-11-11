import test from 'node:test';

import { runGw2Runtime } from '#gw2/platform/simulation/runtime.js';

import { assertManifestRegressions } from './preset-benchmark.js';

// Every Engineer preset must load and simulate without warnings, including the new rifle recording.
test('Engineer presets load without warnings and stay within 1% DPS', () =>
  assertManifestRegressions('engineer', (adapter, rotation, config) =>
    runGw2Runtime({ profession: adapter.profession.runtimeFor(config), rotation, config })
  ));
