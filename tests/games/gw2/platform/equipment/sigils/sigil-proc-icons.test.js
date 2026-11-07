import assert from 'node:assert/strict';
import test from 'node:test';

import { SIGIL_NAMES } from '#gw2/platform/equipment/sigils/catalog.js';
import { SIGIL_BY_ID, SIGIL_DATA, SIGIL_PROCS } from '#gw2/platform/equipment/sigils/data.js';

// Selectable sigils need artwork, and proc views must inherit it without pinning asset hashes.
test('all selectable sigils provide an icon', () => {
  for (const name of SIGIL_NAMES) {
    assert.ok(SIGIL_DATA[name].icon, name);
  }
});

test('all proc sigils inherit their canonical sigil icon', () => {
  for (const [id, proc] of Object.entries(SIGIL_PROCS)) {
    assert.equal(proc.icon, SIGIL_BY_ID[Number(id)].icon, id);
  }
});
