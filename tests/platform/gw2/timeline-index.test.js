import assert from 'node:assert/strict';
import test from 'node:test';

import { createGw2TimelineIndex } from '#gw2/platform/combat/query/timeline-index.js';
import { createCanonicalCatalog } from '#gw2/platform/engine/skills/catalog.js';
import { defineProfession } from '#gw2/platform/engine/profession/contract.js';
import { createScheduler } from '#gw2/platform/engine/execution/scheduler.js';
import { createGw2SchedulerPolicy } from '#gw2/platform/scheduler/policy.js';

// Adjacent microseconds remain distinct for swaps, actions, snapshots, resets, and recharge deadlines.
test('timeline state uses canonical instants without admitting future events', () => {
  const events = [
    weaponSetEvent(0.56 + 0.04, 0, 2),
    weaponSetEvent(0.600001, 1, 1),
    { type: 'action', at: 0, skillId: 1, rechargeReadyAt: 0.600001 },
    { type: 'action', at: 0.56 + 0.04, skillId: 2, rechargeReadyAt: 2 },
    { type: 'cooldown_snapshot', at: 0.600002, cooldowns: { 1: 3 } },
    { type: 'marker', action: 'cooldown-reset', at: 0.600003 }
  ];
  const timeline = createGw2TimelineIndex({ events });
  assert.equal(timeline.activeWeaponSetAt(0.599999), 1);
  assert.equal(timeline.activeWeaponSetAt(0.6), 2);
  assert.equal(timeline.activeWeaponSetAt(0.600001), 1);
  assert.equal(timeline.skillOnCooldownAt(1, 0.56 + 0.04), true);
  assert.equal(timeline.skillOnCooldownAt(1, 0.600001), false);
  assert.equal(timeline.skillOnCooldownAt(2, 0.6), false);
  assert.equal(timeline.skillOnCooldownAt(2, 0.600001), true);
  assert.equal(timeline.skillOnCooldownAt(1, 0.600002), true);
  assert.equal(timeline.skillOnCooldownAt(1, 0.600003), false);
});

test('new Compounding Power stacks do not refresh earlier stacks', () => {
  // Each application expires on its own deadline, even when a later stack is still active.
  const timeline = createGw2TimelineIndex({
    events: [
      buffEvent({ kind: 'compounding', at: 0, duration: 8, stacks: 1 }),
      buffEvent({ kind: 'compounding', at: 7, duration: 8, stacks: 1 })
    ]
  });
  assert.equal(timeline.timedStacks('compounding', 7, 8, 5), 2);
  assert.equal(timeline.timedStacks('compounding', 8, 8, 5), 1);
  assert.equal(timeline.timedStacks('compounding', 15, 8, 5), 0);
});

test('scheduler replacements invalidate already-read combat history', () => {
  // Exercise the production policy connection, including replacements followed by ordinary appends.
  let timeline;
  const profession = defineProfession({
    id: 'timeline-fixture',
    name: 'Timeline Fixture',
    catalog: createCanonicalCatalog(),
    attributeRules: {
      modifyAttributes(context, attributes) {
        timeline = context.timeline;
        return attributes;
      }
    }
  });
  const policy = createGw2SchedulerPolicy();
  const { context } = createScheduler({ profession, schedulerPolicy: policy });
  const owner = { source: 'fixture', sourceId: 'fixture.history', actorType: 'player' };
  policy.critical(context, { ...owner, type: 'damage', at: 0, coefficient: 1 });
  const buff = context.emit({ ...owner, type: 'buff', at: 0, kind: 'might', duration: 1, stacks: 1 });
  const action = context.emit({ ...owner, type: 'action', at: 0, skillId: 1, rechargeReadyAt: 1 });
  assert.equal(timeline.timedStacks('might', 0.5, 0, 25), 1);
  assert.equal(timeline.skillOnCooldownAt(1, 0.5), true);

  context.replaceEvent(buff, { duration: 10 });
  context.replaceEvent(action, { rechargeReadyAt: 10 });
  context.emit({ ...owner, type: 'marker', at: 1 });
  assert.equal(timeline.timedStacks('might', 2, 0, 25), context.buffStacks('might', 2));
  assert.equal(timeline.timedStacks('might', 2, 0, 25), 1);
  assert.equal(timeline.skillOnCooldownAt(1, 2), true);

  const snapshot = context.emit({ ...owner, type: 'cooldown_snapshot', at: 3, cooldowns: { 1: 10 } });
  assert.equal(timeline.skillOnCooldownAt(1, 4), true);
  context.replaceEvent(snapshot, { cooldowns: {} });
  assert.equal(timeline.skillOnCooldownAt(1, 4), false);
  assert.equal(timeline.skillOnCooldownAt(1, 2), true);

  const firstSwap = context.emit({ ...owner, type: 'weapon_set', at: 2, weaponSet: 2 });
  context.emit({ ...owner, type: 'weapon_set', at: 2, weaponSet: 1 });
  assert.equal(timeline.activeWeaponSetAt(2), 1);
  context.replaceEvent(firstSwap, { at: 3 });
  assert.equal(timeline.activeWeaponSetAt(2), 1);
  assert.equal(timeline.activeWeaponSetAt(3), 2);

  // Type changes must remove old buckets and add newly indexed event types.
  const marker = context.replaceEvent(buff, { type: 'marker' });
  assert.equal(timeline.timedStacks('might', 2, 0, 25), 0);
  context.replaceEvent(marker, { type: 'buff', kind: 'fury' });
  assert.equal(timeline.timedActive('fury', 2), true);
  assert.equal(timeline.timedActive('might', 2), false);
});

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

// Small histories exercise cache reuse and invalidation without coupling expectations to a saved rotation.
function buffEvent(overrides = {}) {
  return {
    type: 'buff',
    at: 0,
    source: 'Trait',
    sourceId: 'fixture.buff',
    kind: 'might',
    duration: 2,
    stacks: 4,
    resolvedAudience: {
      includesSelf: true,
      includesSummons: true,
      alliedPlayerCount: 0,
      companionIds: ['pet-a'],
      recipientCount: 2
    },
    ...overrides
  };
}

test('repeated timeline queries reuse answers, including zero stacks and a ready cooldown', () => {
  let buffReads = 0;
  let cooldownReads = 0;
  // Count history reads so removing memoization fails this check without relying on wall-clock timing.
  const measured = buffEvent();
  Object.defineProperty(measured, 'duration', {
    get() {
      buffReads++;
      return 2;
    }
  });
  const timeline = createGw2TimelineIndex({
    events: [
      measured,
      {
        type: 'action',
        at: 0,
        skillId: 1,
        get rechargeReadyAt() {
          cooldownReads++;
          return 2;
        }
      }
    ]
  });
  for (const [time, stacks, cooldown] of [
    [1, 4, true],
    [2, 0, false],
    [1, 4, true]
  ]) {
    assert.equal(timeline.buffStacksAt('might', time, 0, 25), stacks);
    assert.equal(timeline.skillOnCooldownAt(1, time), cooldown);
    const reads = [buffReads, cooldownReads];
    assert.equal(timeline.buffStacksAt('might', time, 0, 25), stacks);
    assert.equal(timeline.skillOnCooldownAt(1, time), cooldown);
    assert.deepEqual([buffReads, cooldownReads], reads);
  }
});

test('same-time appends, replacements, resets, and truncation invalidate timeline answers', () => {
  const events = [buffEvent(), { type: 'action', at: 0, skillId: 1, rechargeReadyAt: 2 }];
  const timeline = createGw2TimelineIndex({ events });
  assert.equal(timeline.timedStacks('might', 1, 0, 25), 4);
  assert.equal(timeline.skillOnCooldownAt(1, 1), true);
  assert.equal(timeline.skillOnCooldownAt(2, 1), false);

  events.push(buffEvent({ at: 1, stacks: 2 }), { type: 'cooldown_snapshot', at: 1, cooldowns: { 2: 3 } });
  assert.equal(timeline.timedStacks('might', 1, 0, 25), 6);
  assert.equal(timeline.skillOnCooldownAt(1, 1), false);
  assert.equal(timeline.skillOnCooldownAt(2, 1), true);

  const previous = events[0];
  events[0] = { ...previous, duration: 0.5 };
  timeline.onEventReplaced(previous, events[0]);
  assert.equal(timeline.timedStacks('might', 1, 0, 25), 2);
  const snapshot = events[3];
  events[3] = { ...snapshot, cooldowns: { 1: 3 } };
  timeline.onEventReplaced(snapshot, events[3]);
  assert.equal(timeline.skillOnCooldownAt(1, 1), true);
  assert.equal(timeline.skillOnCooldownAt(2, 1), false);

  events.push({ type: 'marker', action: 'cooldown-reset', at: 1 });
  assert.equal(timeline.skillOnCooldownAt(1, 1), false);
  assert.equal(timeline.skillOnCooldownAt(1, 0.25), true);
  assert.equal(timeline.timedStacks('might', 0.25, 0, 25), 4);
  events.length = 0;
  assert.equal(timeline.timedStacks('might', 0.25, 0, 25), 0);
  assert.equal(timeline.skillOnCooldownAt(1, 0.25), false);
});

test('buff query arguments and timeline instances cannot share another audience or duration answer', () => {
  const events = [
    buffEvent({ duration: undefined }),
    buffEvent({
      source: 'Player',
      stacks: 6,
      resolvedAudience: {
        includesSelf: false,
        includesSummons: true,
        alliedPlayerCount: 0,
        companionIds: ['pet-b'],
        recipientCount: 1
      }
    })
  ];
  const timeline = createGw2TimelineIndex({ events });
  assert.equal(timeline.buffStacksAt('might', 1, 0, 25), 0);
  assert.equal(timeline.buffStacksAt('might', 1, 2, 25), 4);
  assert.equal(timeline.buffStacksAt('might', 1, 2, 2), 2);
  assert.equal(timeline.buffStacksAt('might', 1, 2, 25, 'summon'), 10);
  assert.equal(timeline.buffStacksAt('might', 1, 2, 25, 'summon', 'pet-a'), 4);
  assert.equal(timeline.buffStacksAt('might', 1, 2, 25, 'summon', 'pet-b'), 6);
  assert.equal(timeline.buffStacksAt('might', 1, 2, 25, 'summon', null), 0);
  assert.equal(timeline.buffStacksAt('might', 1, 2, 25, 'summon-trait'), 4);
  assert.equal(timeline.buffStacksAt('fury', 1, 2, 25), 0);
  assert.equal(createGw2TimelineIndex().buffStacksAt('might', 1, 2, 25), 0);
});

test('appended and replaced boon extensions invalidate intensity and duration queries', () => {
  const events = [buffEvent(), buffEvent({ kind: 'fury', stacks: 1 })];
  const timeline = createGw2TimelineIndex({ events });
  assert.equal(timeline.timedStacks('might', 2.5, 0, 25), 0);
  assert.equal(timeline.timedActive('fury', 2.5), false);
  const extension = { type: 'boon_extension', at: 1, duration: 2, source: 'Trait' };
  events.push(extension);
  assert.equal(timeline.timedStacks('might', 2.5, 0, 25), 4);
  assert.equal(timeline.timedActive('fury', 2.5), true);
  events[2] = { ...extension, duration: 0.25 };
  timeline.onEventReplaced(extension, events[2]);
  assert.equal(timeline.timedStacks('might', 2.5, 0, 25), 0);
  assert.equal(timeline.timedActive('fury', 2.5), false);
  assert.equal(timeline.timedStacks('might', 0.5, 0, 25), 4);
  assert.equal(timeline.timedActive('fury', 0.5), true);
});
