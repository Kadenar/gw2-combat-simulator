import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { assertManifestRegressions } from './preset-benchmark.js';

test('Revenant presets load and stay within 1% DPS', () => assertManifestRegressions('revenant'));

test('Condition Renegade spear preset counts opener damage from the first hit', async () => {
  // This preset intentionally has no explicit combat marker because its
  // precasts deal opener damage that belongs in the simulated DPS window.
  const saved = JSON.parse(
    await readFile(
      new URL('../../../data/gw2/rotations/revenant/r-condi-renegade-spear-mace-axe-bench.json', import.meta.url),
      'utf8'
    )
  );

  assert.equal(
    saved.rotation.some((entry) => entry?.name === '__combat_start'),
    false
  );
});
