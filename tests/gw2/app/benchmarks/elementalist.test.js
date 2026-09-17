import test from 'node:test';

import { assertManifestRegressions } from './preset-benchmark.js';

test('Elementalist presets load and stay within 1% DPS', () => assertManifestRegressions('elementalist'));
