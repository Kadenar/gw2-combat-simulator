import test from 'node:test';

import { assertManifestRegressions } from './preset-benchmark.js';

test('Revenant presets load and stay within 1% DPS', () => assertManifestRegressions('revenant'));
