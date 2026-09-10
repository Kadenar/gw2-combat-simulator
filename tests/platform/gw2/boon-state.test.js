import assert from 'node:assert/strict';
import test from 'node:test';

import {
  durationStackingBoonCapSeconds,
  isDurationStackingBoon,
  recordBuffApplication,
  remainingDurationStackSeconds,
  standardBoonPresentation
} from '#gw2/platform/combat/state/boons.js';

// Prepared applications retain their audience and expired history for timestamp queries in either phase.
test('buff recording requires an audience and retains normalized application history', () => {
  const boons = new Map();
  const event = {
    type: 'buff',
    kind: 'Might',
    at: 1,
    duration: 2,
    stacks: 3,
    source: 'Trait',
    sourceId: 1,
    actorType: 'player'
  };
  assert.throws(() => recordBuffApplication(boons, event), /require resolvedAudience/);
  assert.equal(boons.size, 0);
  const resolvedAudience = {
    includesSelf: true,
    includesSummons: false,
    alliedPlayerCount: 0,
    companionIds: [],
    recipientCount: 1
  };
  const history = recordBuffApplication(boons, { ...event, resolvedAudience });
  const later = recordBuffApplication(boons, {
    ...event,
    kind: 'might',
    at: 5,
    duration: -1,
    stacks: 0,
    resolvedAudience
  });
  assert.equal(later, history);
  assert.equal(boons.get('might'), history);
  assert.equal(boons.size, 1);
  assert.deepEqual(history, [
    { at: 1, expiresAt: 3, stacks: 3, source: 'Trait', resolvedAudience },
    { at: 5, expiresAt: 5, stacks: 1, source: 'Trait', resolvedAudience }
  ]);
});

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
