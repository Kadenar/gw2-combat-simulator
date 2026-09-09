import assert from 'node:assert/strict';
import test from 'node:test';

import { warriorCatalog } from '#gw2/professions/warrior/catalog.js';
import { GW2_ACTION_TICK_MS } from '#gw2/platform/skills/timing.js';

// Validate authored effect offsets, including generated packets and profiles, before runtime cast scaling.
test('Warrior authored effect offsets stay on the 40 ms action grid', () => {
  for (const entry of [...warriorCatalog.skills, ...warriorCatalog.balanceProfiles]) {
    for (const effect of entry.effects ?? []) {
      const offsets = [effect.atMs, ...(effect.ticks ?? []).map((tick) => tick.atMs)].filter((atMs) => atMs != null);
      for (const atMs of offsets) {
        assert.equal(atMs % GW2_ACTION_TICK_MS, 0, `${entry.id} ${entry.name}: ${effect.type} at ${atMs} ms`);
      }
    }
  }
});
