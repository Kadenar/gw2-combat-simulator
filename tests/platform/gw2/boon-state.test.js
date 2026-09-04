import assert from 'node:assert/strict';
import test from 'node:test';

import {
  durationStackingBoonCapSeconds,
  isDurationStackingBoon,
  remainingDurationStackSeconds,
  standardBoonPresentation
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
    assert.deepEqual(standardBoonPresentation(kind), {
      name: `${kind[0].toUpperCase()}${kind.slice(1)}`,
      maximumDuration: cap
    });
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

test('standard boon presentation owns the Might stack cap', () => {
  assert.deepEqual(standardBoonPresentation('might'), { name: 'Might', maximumStacks: 25 });
  assert.equal(standardBoonPresentation('profession-effect'), null);
});
