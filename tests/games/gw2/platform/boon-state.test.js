import assert from 'node:assert/strict';
import test from 'node:test';
import { activeBoonStacks, boonActive } from '#gw2/platform/combat/query/runtime-query.js';
import { runtimeTargetConditionStacks } from '#gw2/platform/combat/state/targets.js';
import { gw2BuffActiveForAudience } from '#gw2/platform/execution/gw2-policy/policy.js';
import { createScheduledEvents } from '#gw2/platform/execution/scheduled-events.js';

import {
  durationStackingBoonCapSeconds,
  isDurationStackingBoon,
  recordBuffApplication,
  remainingDurationStackSeconds,
  standardBoonPresentation
} from '#gw2/platform/combat/boons.js';

// Use the scheduler's real indexes so emission and replacement remain part of the boon-query contract.
function boonContext(events = []) {
  const context = createScheduledEvents({ prepareEvent: (event) => event, observeEvent() {} });
  for (const event of events) context.emit({ source: 'fixture', sourceId: 'boon', actorType: 'player', ...event });
  return context;
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
    assert.equal(gw2BuffActiveForAudience(context, 'might', at, 'summon'), active);
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
  const active = (index, at) =>
    gw2BuffActiveForAudience(context, 'quickness', at, 'summon', `minion:bone-minion:${index}`);
  assert.equal(active(0, 0), true);
  assert.equal(active(1, 0), false);
  assert.equal(active(0, 1), true);
  assert.equal(active(1, 1), true);
  assert.equal(active(0, 2), false);
  assert.equal(active(1, 2), true);
  assert.equal(active(1, 3), false);
  // A self-only extension must neither extend a companion nor change which companion owned the original boon.
  context.emit({
    type: 'boon_extension',
    source: 'fixture',
    sourceId: 'extension',
    actorType: 'player',
    at: 1.5,
    duration: 4,
    resolvedAudience: { includesSelf: true, includesSummons: false, companionIds: [] }
  });
  assert.equal(active(0, 2), false);
  assert.equal(active(1, 2), true);
  assert.equal(active(1, 3), false);
});

test('indexed summon boons preserve history across out-of-order grants and event replacements', () => {
  // Cap duration chronologically, isolate recipients, and update kind/type/audience membership after replacements.
  const summon = {
    includesSelf: false,
    includesSummons: true,
    companionIds: ['pet'],
    recipientCount: 1,
    alliedPlayerCount: 0
  };
  const self = { ...summon, includesSelf: true, includesSummons: false, companionIds: [] };
  const context = boonContext([
    { type: 'buff', kind: 'quickness', at: 20, duration: 25, resolvedAudience: summon },
    { type: 'buff', kind: 'quickness', at: 0, duration: 30, resolvedAudience: summon },
    { type: 'buff', kind: 'quickness', at: 40, duration: 30, resolvedAudience: self }
  ]);
  const [later, earlier, selfOnly] = context.events;
  const active = (at, companionId = 'pet') => gw2BuffActiveForAudience(context, 'quickness', at, 'summon', companionId);
  assert.deepEqual(context.buffEvents('Quickness', 'summon'), [earlier, later]);
  assert.deepEqual(context.buffEvents('quickness'), [selfOnly]);
  // Queries must use the indexes even when unrelated event history is unavailable.
  const indexed = {
    ...context,
    get events() {
      return assert.fail('Summon queries must not scan the full event log');
    }
  };
  assert.equal(gw2BuffActiveForAudience(indexed, 'quickness', 49.999999, 'summon', 'pet'), true);
  assert.equal(active(50), false);
  assert.equal(active(25, 'other'), false);
  assert.equal(active(1), true);
  context.replaceEvent(later, { at: 35, duration: 2 });
  assert.equal(active(34), false);
  assert.equal(active(36), true);
  context.replaceEvent(later, { kind: 'might' });
  assert.equal(active(36), false);
  assert.equal(gw2BuffActiveForAudience(context, 'might', 36, 'summon', 'pet'), true);
  context.replaceEvent(later, { type: 'marker' });
  assert.equal(context.buffEvents('might', 'summon').length, 0);
  context.replaceEvent(earlier, { resolvedAudience: self });
  assert.equal(active(1), false);
  context.replaceEvent(earlier, { resolvedAudience: summon });
  assert.equal(active(1), true);
  const extension = context.emit({
    type: 'boon_extension',
    at: 29,
    duration: 4,
    kind: 'quickness',
    extensionAudience: 'all',
    source: 'fixture',
    sourceId: 'extension',
    actorType: 'player'
  });
  assert.equal(gw2BuffActiveForAudience(indexed, 'quickness', 33.999999, 'summon', 'pet'), true);
  assert.equal(active(34), false);
  context.replaceEvent(extension, { duration: 1 });
  assert.equal(active(31), false);
  context.replaceEvent(extension, { at: 31, duration: 4 });
  assert.equal(active(32), false);
  assert.equal(active(1), true);
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
  }
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
