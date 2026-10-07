import assert from 'node:assert/strict';
import test from 'node:test';
import { createGw2TimelineIndex } from '#gw2/platform/combat-calculation/timeline-index.js';
import { createCooldownController } from '#gw2/platform/execution/cooldowns.js';
import { projectRecharge } from '#gw2/platform/combat/recharge.js';

// Received duration pools stay separate; retirement invalidates cached projections without erasing earned work.
test('companion recharge windows isolate grants, extensions and retirement', () => {
  const grant = (companionId) => ({
    type: 'buff',
    kind: 'alacrity',
    at: 0,
    duration: 4,
    stacks: 1,
    resolvedAudience: {
      includesSelf: false,
      includesSummons: true,
      companionIds: [companionId],
      alliedPlayerCount: 0,
      recipientCount: 1
    }
  });
  const events = [grant('a'), grant('b')];
  const skill = { id: 1, rechargeBuffAudience: 'summon' };
  const timeline = createGw2TimelineIndex({ events });
  const ready = (companionId) =>
    projectRecharge({ startedAt: 0, work: 10 }, timeline.rechargeIntervals(skill, 0, Infinity, companionId));
  assert.equal(ready('a'), 9);
  assert.equal(ready('b'), 9);
  assert.equal(ready('c'), 10);
  events.push({ type: 'boon_extension', at: 2, duration: 2, kind: 'alacrity', extensionAudience: 'all' });
  assert.equal(ready('a'), 8.5);
  assert.equal(ready('b'), 8.5);
  assert.equal(ready('c'), 10);
  events.push({ type: 'marker', action: 'companion-retired', summonOwner: 'a', at: 3 });
  assert.equal(ready('a'), 9.25);
  assert.equal(ready('b'), 8.5);
  // A later lifetime's grant cannot revive an old owner's retired boon pool.
  events.push({ ...grant('a:next'), at: 4, duration: 30 });
  assert.equal(ready('a'), 9.25);
  assert.throws(() => [...timeline.rechargeIntervals(skill, 0, 10)], /companion identity/);
  assert.deepEqual(
    [...timeline.rechargeIntervals({ ...skill, rechargeIgnoresAlacrity: true }, 0, 10)],
    [{ start: 0, end: 10, rate: 1 }]
  );
});

// Constant recharge rates bypass boon history, including explicit false console inputs.
test('player recharge never samples Alacrity grants or expiry', () => {
  for (const alacrity of [undefined, false, true]) {
    const events = [
      {
        get type() {
          throw new Error('Recharge sampled boon history');
        }
      }
    ];
    const timeline = createGw2TimelineIndex({ events, config: { boons: { alacrity } } });
    assert.deepEqual(
      [...timeline.rechargeIntervals({ id: 1, rechargeBuffAudience: 'self' }, 2, 12)],
      [{ start: 2, end: 12, rate: 1.25 }]
    );
    assert.deepEqual(
      [...timeline.rechargeIntervals({ id: 2, rechargeIgnoresAlacrity: true }, 2, 12)],
      [{ start: 2, end: 12, rate: 1 }]
    );
  }
});

// The platform consumes the module's declared rate without identifying its specialization.
test('declared recharge rate applies only to player skills', () => {
  const timeline = createGw2TimelineIndex({ playerAlacrityRechargeRate: 1.5 });
  const skill = { id: 1, name: 'Recharge' };
  for (const [selected, rate] of [
    [skill, 1.5],
    [{ ...skill, rechargeBuffAudience: 'summon' }, 1],
    [{ ...skill, rechargeIgnoresAlacrity: true }, 1]
  ]) {
    assert.deepEqual(
      [...timeline.rechargeIntervals(selected, 0, 10, 'fixture-companion')],
      [{ start: 0, end: 10, rate }]
    );
  }
});

// Readiness is owned by the live controller, including same-time mutations that have no event-log entry.
test('cooldown queries observe live completion, reset, and restoration without caching history', () => {
  const clock = { time: 0 };
  const skill = { id: 1, name: 'Recharge', cooldown: 10 };
  const controller = createCooldownController({ clock, skillFor: () => skill, rechargeDuration: () => 10 });
  const timeline = createGw2TimelineIndex({
    events: [
      {
        get type() {
          throw new Error('Cooldown query sampled event history');
        }
      }
    ],
    skillOnCooldown: (id, at) => controller.isOnCooldown(id, at)
  });
  assert.equal(timeline.skillOnCooldownAt(1, 0), false);
  controller.startRecharge(skill, 0);
  assert.equal(timeline.skillOnCooldownAt(1, 0), true);
  clock.time = 0.6;
  assert.equal(timeline.skillOnCooldownAt(1, 0.56 + 0.04), true);
  const checkpoint = controller.checkpoint(clock.time, new Set(), 2);
  controller.resetAll();
  assert.equal(timeline.skillOnCooldownAt(1, clock.time), false);
  controller.restoreCheckpoint(checkpoint, clock.time, new Set(), []);
  assert.equal(timeline.skillOnCooldownAt(1, clock.time), true);
  clock.time = 9.999999;
  assert.equal(timeline.skillOnCooldownAt(1, clock.time), true);
  clock.time = 10;
  assert.equal(timeline.skillOnCooldownAt(1, clock.time), false);
  assert.throws(() => timeline.skillOnCooldownAt(1, 11), /current clock/);
});

// A detached formula query must declare readiness instead of silently treating unknown cooldowns as ready.
test('cooldown queries require an explicit readiness provider', () => {
  assert.throws(() => createGw2TimelineIndex().skillOnCooldownAt(1, 0), /readiness provider/);
  const preview = createGw2TimelineIndex({ skillOnCooldown: () => false });
  assert.equal(preview.skillOnCooldownAt(1, 0), false);
});

// Adjacent canonical instants remain distinct for historical weapon-set observations.
test('timeline state uses canonical instants without admitting future events', () => {
  const events = [weaponSetEvent(0.56 + 0.04, 0, 2), weaponSetEvent(0.600001, 1, 1)];
  const timeline = createGw2TimelineIndex({ events });
  assert.equal(timeline.activeWeaponSetAt(0.599999), 1);
  assert.equal(timeline.activeWeaponSetAt(0.6), 2);
  assert.equal(timeline.activeWeaponSetAt(0.600001), 1);
});

test('new Compounding Power stacks do not refresh earlier stacks', () => {
  // Each application expires on its own deadline, even when a later stack is still active.
  const timeline = createGw2TimelineIndex({
    events: [
      buffEvent({ kind: 'compounding', at: 0, duration: 8, stacks: 1 }),
      buffEvent({ kind: 'compounding', at: 7, duration: 8, stacks: 1 })
    ]
  });
  assert.equal(timeline.buffStacksAt('compounding', 7, 8, 5), 2);
  assert.equal(timeline.buffStacksAt('compounding', 8, 8, 5), 1);
  assert.equal(timeline.buffStacksAt('compounding', 15, 8, 5), 0);
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

test('repeated timeline queries reuse answers, including zero stacks', () => {
  let buffReads = 0;
  // Count history reads so removing memoization fails without relying on wall-clock timing.
  const measured = buffEvent();
  Object.defineProperty(measured, 'duration', {
    get() {
      buffReads++;
      return 2;
    }
  });
  const timeline = createGw2TimelineIndex({ events: [measured] });
  for (const [time, stacks] of [
    [1, 4],
    [2, 0],
    [1, 4]
  ]) {
    assert.equal(timeline.buffStacksAt('might', time, 0, 25), stacks);
    const reads = buffReads;
    assert.equal(timeline.buffStacksAt('might', time, 0, 25), stacks);
    assert.equal(buffReads, reads);
  }
});

test('same-time appends and truncation invalidate timeline answers', () => {
  const events = [buffEvent()];
  const timeline = createGw2TimelineIndex({ events, resolved: true });
  assert.equal(timeline.buffStacksAt('might', 1, 0, 25), 4);
  events.push(buffEvent({ at: 1, stacks: 2 }));
  assert.equal(timeline.buffStacksAt('might', 1, 0, 25), 6);
  assert.equal(timeline.buffStacksAt('might', 0.25, 0, 25), 4);
  events.length = 0;
  assert.equal(timeline.buffStacksAt('might', 0.25, 0, 25), 0);
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

test('appended boon extensions invalidate intensity and duration queries', () => {
  const events = [buffEvent(), buffEvent({ kind: 'fury', stacks: 1 })];
  const timeline = createGw2TimelineIndex({ events });
  assert.equal(timeline.buffStacksAt('might', 2.5, 0, 25), 0);
  assert.equal(timeline.timedActive('fury', 2.5), false);
  const extension = { type: 'boon_extension', at: 1, duration: 2, source: 'Trait' };
  events.push(extension);
  assert.equal(timeline.buffStacksAt('might', 2.5, 0, 25), 4);
  assert.equal(timeline.timedActive('fury', 2.5), true);
  assert.equal(timeline.buffStacksAt('might', 0.5, 0, 25), 4);
  assert.equal(timeline.timedActive('fury', 0.5), true);
});

test('buff history bounds preserve mixed lifetimes, fallback durations, and backward queries', () => {
  // A later short grant must not hide an older long grant, and a late insertion can widen the lifetime bound.
  const events = [
    buffEvent({ at: 0, duration: 1, stacks: 1 }),
    buffEvent({ at: 1, duration: 10, stacks: 2 }),
    buffEvent({ at: 2, duration: 0, stacks: 8 }),
    buffEvent({ at: 3, duration: undefined, stacks: 4 }),
    buffEvent({ at: 8, duration: 1, stacks: 16 }),
    buffEvent({ at: 20, duration: 1, stacks: 32 })
  ];
  const timeline = createGw2TimelineIndex({ events });
  assert.equal(timeline.buffStacksAt('might', 9, 2, 100), 2);
  assert.equal(timeline.buffStacksAt('might', 11, 2, 100), 0);
  assert.equal(timeline.buffStacksAt('might', 4, 2, 100), 6);
  assert.equal(timeline.buffStacksAt('might', 4, 0, 100), 2);
  assert.equal(timeline.buffStacksAt('might', 12, 10, 100), 4);
  events.push(buffEvent({ at: 0.5, duration: 30, stacks: 64 }));
  assert.equal(timeline.buffStacksAt('might', 12, 2, 100), 25);
  assert.equal(timeline.buffStacksAt('might', 0.25, 2, 100), 1);
});

test('buff history bounds retain grants until their quantized expiry', () => {
  // A nominal duration ending between action ticks remains active until the existing expiry rule rounds it up.
  const timeline = createGw2TimelineIndex({
    events: [buffEvent({ kind: 'compounding', at: 0.005, duration: 1, stacks: 1 })]
  });
  assert.equal(timeline.buffStacksAt('compounding', 1.005, 0, 5), 1);
  assert.equal(timeline.buffStacksAt('compounding', 1.04, 0, 5), 0);
});
