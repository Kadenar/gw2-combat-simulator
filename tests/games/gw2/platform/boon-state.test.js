import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { activeBoonStacks, boonActive } from '#gw2/platform/combat/query/runtime-query.js';
import { runtimeTargetConditionStacks, targetHasCondition } from '#gw2/platform/combat/state/targets.js';
import { createGw2TimelineIndex } from '#gw2/platform/combat-calculation/timeline-index.js';

import {
  buffApplicationStacks,
  durationStackingBoonCapSeconds,
  isDurationStackingBoon,
  recordBuffApplication,
  remainingDurationStackSeconds,
  standardBoonPresentation
} from '#gw2/platform/combat/boons.js';

// Both scheduled and accepted histories use canonical, half-open visibility before applying audience and intensity caps.
test('intensity queries preserve canonical visibility in unordered and ordered histories', () => {
  const self = { includesSelf: true, includesSummons: false, companionIds: [] };
  const history = [
    { at: 2, expiresAt: 4, stacks: 30, resolvedAudience: self },
    { at: 0.2, expiresAt: 0.56 + 0.04, stacks: 3, resolvedAudience: self },
    { at: 0.2, expiresAt: 4, stacks: 8, resolvedAudience: { ...self, includesSelf: false } }
  ];
  for (const ordered of [false, true]) {
    const applications = ordered ? [...history].sort((a, b) => a.at - b.at) : history;
    for (const [at, stacks] of [
      [0.199999, 0],
      [0.2, 3],
      [0.599999, 3],
      [0.6, 0],
      [2, 25],
      [4, 0]
    ])
      assert.equal(buffApplicationStacks(applications, 'might', at, 100, { ordered }), stacks);
    assert.equal(buffApplicationStacks(applications, 'might', 0.4, 2, { ordered }), 2);
  }
});

// Historical boon queries use the same index as live execution.
function boonContext(events = []) {
  const history = events.map((event) => ({ source: 'fixture', sourceId: 'boon', actorType: 'player', ...event }));
  const timeline = createGw2TimelineIndex({ events: history });
  return {
    timeline,
    effects: captureEffectEmissions({ submit: (event) => history.push(event) }).effects
  };
}

function activeFor(context, kind, at, audience, companionId) {
  return context.timeline.buffStacksAt(kind, at, 0, 1, audience, companionId) > 0;
}

// Floating-point sums cannot keep summon boons active at their exact canonical expiry.
test('summon intensity boons exclude canonical expiry and preserve the preceding microsecond', () => {
  const context = boonContext([
    {
      type: 'buff',
      at: 0.56,
      duration: 0.04,
      kind: 'might',
      stacks: 1,
      resolvedAudience: { includesSummons: true, companionIds: [] }
    }
  ]);
  for (const [at, active] of [
    [0.559999, false],
    [0.56, true],
    [0.599999, true],
    [0.6, false],
    [0.600001, false]
  ]) {
    assert.equal(activeFor(context, 'might', at, 'summon'), active);
  }
});

// Independent recipients must not combine duration pools or inherit each other's expiry.
test('summon boon queries keep capped recipients in separate duration pools', () => {
  const context = boonContext(
    ['minion:bone-minion:0', 'minion:bone-minion:1'].map((companionId, index) => ({
      type: 'buff',
      kind: 'quickness',
      at: index,
      duration: 2,
      resolvedAudience: { includesSummons: true, companionIds: [companionId] }
    }))
  );
  const active = (index, at) => activeFor(context, 'quickness', at, 'summon', `minion:bone-minion:${index}`);
  assert.equal(active(0, 0), true);
  assert.equal(active(1, 0), false);
  assert.equal(active(0, 1), true);
  assert.equal(active(1, 1), true);
  assert.equal(active(0, 2), false);
  assert.equal(active(1, 2), true);
  assert.equal(active(1, 3), false);
  // A self-only extension must neither extend a companion nor change which companion owned the original boon.
  context.effects.emit({
    kind: 'packet',
    event: {
      type: 'boon_extension',
      source: 'fixture',
      sourceId: 'extension',
      actorType: 'player',
      at: 1.5,
      duration: 4,
      resolvedAudience: { includesSelf: true, includesSummons: false, companionIds: [] }
    }
  });
  assert.equal(active(0, 2), false);
  assert.equal(active(1, 2), true);
  assert.equal(active(1, 3), false);
});

// Presence uses the same microsecond half-open boundary for duration pools, intensity boons, and conditions.
test('status queries retain the last microsecond and exclude canonical expiry', () => {
  const resolvedAudience = { includesSelf: true, includesSummons: false, companionIds: [] };
  const runtime = {
    boons: new Map(
      ['might', 'fury'].map((kind) => [kind, [{ at: 0.2, expiresAt: 0.56 + 0.04, stacks: 1, resolvedAudience }]])
    ),
    conditionState: new Map([['Bleeding', { stacks: [{ appliedAt: 0.2, expiresAt: 0.56 + 0.04, weight: 1 }] }]])
  };
  for (const [time, active] of [
    [0.199999, 0],
    [0.2, 1],
    [0.599999, 1],
    [0.6, 0],
    [0.600001, 0]
  ]) {
    for (const kind of ['might', 'fury']) {
      const context = { time, runtime, config: {} };
      assert.equal(boonActive(context, kind), Boolean(active));
      assert.equal(activeBoonStacks(context, kind), active);
    }

    assert.equal(runtimeTargetConditionStacks(runtime, 'Bleeding', time), active);
    assert.equal(targetHasCondition({}, ' bleeding ', time, runtime), Boolean(active));
  }
});

// Presence respects each accepted lifetime, including historical reads after newer stacks expire or are removed.
test('condition presence preserves history, removals, same-time edits, and permanent assumptions', () => {
  const older = { appliedAt: 0, expiresAt: 8, weight: 1 };
  const newer = { appliedAt: 2, expiresAt: 6, removedAt: 4, weight: 2 };
  const state = { conditionState: new Map([['Bleeding', { stacks: [older, newer] }]]) };
  assert.equal(targetHasCondition({}, 'Bleeding', -1, state), false);
  assert.equal(targetHasCondition({}, 'Bleeding', 1, state), true);
  assert.equal(targetHasCondition({}, 'Bleeding', 4, state), true);
  older.weight = 0;
  assert.equal(targetHasCondition({}, 'Bleeding', 4, state), false);
  assert.equal(targetHasCondition({}, 'Bleeding', 3, state), true);
  newer.removedAt = 3;
  assert.equal(targetHasCondition({}, 'Bleeding', 3, state), false);
  assert.equal(targetHasCondition({ target: { conditions: { Bleeding: true } } }, 'Bleeding', 8, state), true);
  assert.equal(targetHasCondition({}, 'Burning', 0, state), false);
});

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
    { at: 1, expiresAt: 3, stacks: 3, source: 'Trait', resolvedAudience, event: { ...event, resolvedAudience } },
    {
      at: 5,
      expiresAt: 5,
      stacks: 1,
      source: 'Trait',
      resolvedAudience,
      event: { ...event, kind: 'might', at: 5, duration: 0, stacks: 0, resolvedAudience }
    }
  ]);
});

test('duration-stacking boons use their in-game duration caps', () => {
  for (const [kind, cap] of [
    ['quickness', 30],
    ['alacrity', 30],
    ['fury', 30],
    ['protection', 30],
    ['regeneration', 30],
    ['resistance', 30],
    ['resolution', 30],
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
