import assert from 'node:assert/strict';
import test from 'node:test';

import { createGw2TimelineIndex } from '#gw2/platform/combat/query/timeline-index.js';

function weaponSetEvent(at, causalOrder, weaponSet) {
  return {
    type: 'weapon_set',
    at,
    causalOrder,
    source: 'fixture',
    sourceId: `set-${weaponSet}`,
    weaponSet
  };
}

test('timeline indexing orders late events by timestamp and causal order', () => {
  const timeline = createGw2TimelineIndex({
    events: [weaponSetEvent(2, 3, 2), weaponSetEvent(1, 2, 1), weaponSetEvent(1, 1, 2)]
  });

  assert.equal(timeline.activeWeaponSetAt(1), 1);
  assert.equal(timeline.activeWeaponSetAt(2), 2);
});
