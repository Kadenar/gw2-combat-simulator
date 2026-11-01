import assert from 'node:assert/strict';
import test from 'node:test';

import { SPECIALIZATION_BACKGROUNDS } from '#gw2/app/shared/specialization-backgrounds.js';

// The old URL template hid these dependencies from literal-URL scans; cover all current profession catalogs.
test('every specialization has a bundled trait-line background', async () => {
  const names = new Set();
  for (const profession of [
    'elementalist',
    'engineer',
    'guardian',
    'mesmer',
    'necromancer',
    'ranger',
    'revenant',
    'thief',
    'warrior'
  ]) {
    const { TRAIT_LINES } = await import(`#gw2/professions/${profession}/data/trait-lines.js`);
    for (const { name } of TRAIT_LINES) {
      names.add(name);
      assert.ok(SPECIALIZATION_BACKGROUNDS[name], `${profession}: ${name}`);
    }
  }

  assert.deepEqual(Object.keys(SPECIALIZATION_BACKGROUNDS).sort(), [...names].sort());
});
