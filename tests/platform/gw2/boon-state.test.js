import assert from 'node:assert/strict';
import test from 'node:test';

import {
  durationStackingBoonCapSeconds,
  isDurationStackingBoon,
  remainingDurationStackSeconds
} from '#gw2/platform/combat/state/boons.js';

test('duration-stacking boons use their in-game duration caps', () => {
  for (const [kind, cap] of [
    ['quickness', 30],
    ['alacrity', 30],
    ['fury', 30],
    ['protection', 30],
    ['vigor', 30],
    ['swiftness', 60]
  ]) {
    assert.equal(isDurationStackingBoon(kind), true, kind);
    assert.equal(durationStackingBoonCapSeconds(kind), cap, kind);
    assert.equal(
      remainingDurationStackSeconds(
        [
          { at: 0, duration: cap - 1 },
          { at: 1, duration: 5 }
        ],
        1,
        { maximum: durationStackingBoonCapSeconds(kind) }
      ),
      cap,
      kind
    );
  }
});
