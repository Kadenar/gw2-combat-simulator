import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { runGw2Runtime } from '#gw2/platform/simulation/runtime.js';
import { assertManifestRegressions } from './preset-benchmark.js';

// Exercise the registered live family until the shared application entry cuts over in phase 6.
test('Revenant presets load and stay within 1% DPS', () =>
  assertManifestRegressions('revenant', (adapter, rotation, config) =>
    runGw2Runtime({ profession: adapter.profession.runtimeFor(config), config, rotation })
  ));

test('Condition Renegade spear preset counts opener damage from the first hit', async () => {
  // This preset intentionally has no explicit combat marker because its
  // precasts deal opener damage that belongs in the simulated DPS window.
  const saved = JSON.parse(
    await readFile(
      new URL('../../../../../data/gw2/rotations/revenant/r-condi-renegade-spear-mace-axe-bench.json', import.meta.url),
      'utf8'
    )
  );

  assert.equal(
    saved.rotation.some((entry) => entry?.type === 'combat-start'),
    false
  );
});
