import assert from 'node:assert/strict';
import test from 'node:test';
import { gw2BoonApplicationRecipients } from '#gw2/platform/combat/state/allied-players.js';
import { boonIntervalsFromWindows, prepareBoonWindows } from '#gw2/platform/combat/boons.js';

import {
  advanceEndurance,
  advanceEnduranceIntervals,
  createVigorWindowReader,
  enduranceIntervalsReadyAt,
  vigorEnduranceIntervals,
  grantEndurance,
  spendEndurance
} from '#gw2/platform/combat/resources/endurance.js';

// Test clocks carry capacity and their settled rate alongside the balance.
const clock = (value, updatedAt = 0, maximum = 100, rate = 0) => ({ value, maximum, updatedAt, rate });

// Accepted grants carry resolved recipients; the cache must preserve their ordering and audience semantics.
const vigorGrant = (at, duration, recipients = 'self') => {
  const event = {
    type: 'buff',
    kind: 'vigor',
    at,
    duration,
    audience: { recipients, affectsSelf: recipients === 'self' }
  };
  return { ...event, resolvedAudience: gw2BoonApplicationRecipients({}, event) };
};

test('Vigor cache reads each appended fact once and keeps independent runtime histories', () => {
  const history = [vigorGrant(0, 2)];
  const reads = [];
  const events = new Proxy(history, {
    get(target, key, receiver) {
      if (typeof key === 'string' && /^\d+$/.test(key)) reads.push(Number(key));

      return Reflect.get(target, key, receiver);
    }
  });
  const windows = createVigorWindowReader(events);
  assert.deepEqual(reads, [], 'Constructing the reader must remain lazy for permanent Vigor');
  const first = windows();
  assert.equal(windows(), first);
  history.push(
    { type: 'action', at: 0 },
    { ...vigorGrant(0, 10), kind: 'fury' },
    { type: 'boon_extension', at: 0, duration: 10, excludedKind: 'vigor' },
    { ...vigorGrant(0, 10), cancelled: true }
  );
  assert.equal(windows(), first, 'Unrelated and cancelled facts must reuse the prepared windows');
  assert.deepEqual(reads, [0, 1, 2, 3, 4]);
  assert.equal(windows(), first);
  assert.deepEqual(reads, [0, 1, 2, 3, 4], 'Repeated queries must not reread old history');
  assert.deepEqual(
    [...boonIntervalsFromWindows(createVigorWindowReader([])(), 0, 3)],
    [{ start: 0, end: 3, active: false }]
  );
});

test('Vigor cache refreshes same-time affordability without changing earlier windows', () => {
  const history = [];
  const windows = createVigorWindowReader(history);
  const context = { config: {}, vigorWindows: windows };
  const ready = () =>
    enduranceIntervalsReadyAt(
      clock(0),
      30,
      vigorEnduranceIntervals(context, 0, Infinity, (active) => (active ? 10 : 5))
    );
  assert.equal(ready(), 6);
  // An extension before the first grant cannot create Vigor, even at the same timestamp.
  history.push({ type: 'boon_extension', at: 0, duration: 3 });
  assert.equal(ready(), 6);
  history.push(vigorGrant(0, 2));
  assert.equal(ready(), 4);
  const beforeExtension = windows();
  history.push({ type: 'boon_extension', at: 0, duration: 3 });
  assert.equal(ready(), 3);
  assert.deepEqual(
    [...boonIntervalsFromWindows(beforeExtension, 0, 6)],
    [
      { start: 0, end: 2, active: true },
      { start: 2, end: 6, active: false }
    ]
  );
  assert.equal(
    advanceEnduranceIntervals(
      clock(0),
      vigorEnduranceIntervals(context, 0, 3, (active) => (active ? 10 : 5))
    ).value,
    30
  );
});

test('cached Vigor preserves duration caps, expiry, and recipient filtering as execution advances', () => {
  const history = [];
  const windows = createVigorWindowReader(history);
  // Compare a minimal sequence at every append, including absent/excluded kinds and extensions after expiry.
  for (const event of [
    vigorGrant(0, 10, 'summons'),
    { type: 'boon_extension', at: 0, duration: 5, extensionAudience: 'all' },
    vigorGrant(1, 50),
    { type: 'boon_extension', at: 2, kind: 'vigor', duration: 5 },
    { type: 'boon_extension', at: 3, kind: 'fury', duration: 5 },
    { type: 'boon_extension', at: 4, excludedKind: 'vigor', duration: 5 },
    { ...vigorGrant(5, 10), cancelled: true },
    { type: 'boon_extension', at: 32, duration: 5 },
    vigorGrant(33, 2)
  ]) {
    history.push(event);
    assert.deepEqual(windows(), prepareBoonWindows(history, 'vigor', 'self', undefined, true));
  }

  assert.deepEqual(
    [...boonIntervalsFromWindows(windows(), 31, 36)],
    [
      { start: 31, end: 32, active: true },
      { start: 32, end: 33, active: false },
      { start: 33, end: 35, active: true },
      { start: 35, end: 36, active: false }
    ]
  );
});

// Readiness under one constant regeneration rate starting at the observed time.
function steadyEnduranceReadyAt(endurance, cost, at, rate) {
  return enduranceIntervalsReadyAt(clock(endurance, at, 100, rate), cost, [{ start: at, end: Infinity, rate }]);
}

test('endurance affordability snaps to ticks without rounding fractional recovery or losing short boon windows', () => {
  const state = clock(0, 0);
  assert.ok(Math.abs(advanceEndurance(state, 0.1, 3).value - 0.3) < 1e-12);
  assert.equal(steadyEnduranceReadyAt(0, 1, 0, 3), 0.36);
  assert.equal(steadyEnduranceReadyAt(1, 1, 0.1, 3), 0.1);
  assert.equal(
    enduranceIntervalsReadyAt(state, 1, [
      { start: 0, end: 0.34, rate: 3 },
      { start: 0.34, end: Infinity, rate: 0 }
    ]),
    0.36
  );
});

test('Vigor endurance windows share self-only recovery and readiness with profession rate policy', () => {
  // A cancelled or companion-only grant cannot fund a player dodge; permanent Vigor bypasses history.
  const vigor = {
    type: 'buff',
    source: 'Fixture',
    actorType: 'player',
    kind: 'vigor',
    at: 1,
    duration: 2,
    stacks: 1,
    audience: { recipients: 'self' }
  };
  const context = {
    config: {},
    vigorWindows: createVigorWindowReader(
      [
        { ...vigor, at: 0, duration: 20, cancelled: true },
        { ...vigor, at: 0, duration: 20, audience: { recipients: 'summons', affectsSelf: false } },
        vigor
      ].map((event) => ({ ...event, resolvedAudience: gw2BoonApplicationRecipients({}, event) }))
    )
  };
  const observed = [];
  const rateAt = (active, at) => {
    observed.push([active, at]);
    return active ? 10 : 5;
  };

  const state = clock(0, 0);
  assert.deepEqual(
    advanceEnduranceIntervals(state, vigorEnduranceIntervals(context, 0, 4, rateAt)),
    clock(30, 4, 100, 5)
  );
  assert.deepEqual(observed, [
    [false, 0],
    [true, 1],
    [false, 3]
  ]);
  assert.equal(enduranceIntervalsReadyAt(state, 30, vigorEnduranceIntervals(context, 0, Infinity, rateAt)), 4);
  const permanent = {
    config: { boons: { vigor: true } },
    vigorWindows: () => assert.fail('Permanent Vigor must not read event history')
  };
  assert.equal(enduranceIntervalsReadyAt(state, 30, vigorEnduranceIntervals(permanent, 0, Infinity, rateAt)), 3);
});

test('endurance advancement caps regeneration and does not mutate or rewind its input', () => {
  const state = Object.freeze(clock(40, 2, 60));

  assert.deepEqual(advanceEndurance(state, 8, 5), clock(60, 8, 60, 5));
  assert.deepEqual(advanceEndurance(state, 1, 5), state);
  assert.deepEqual(state, clock(40, 2, 60));
});

test('permanent Vigor preserves profession rate boundaries without reading history', () => {
  // Permanent Vigor still permits timed profession bonuses to expire inside an observation window.
  const context = {
    config: { boons: { vigor: true } },
    vigorWindows: () => assert.fail('Permanent Vigor must not read event history')
  };
  for (const end of [5, Infinity]) {
    assert.deepEqual(
      [...vigorEnduranceIntervals(context, 2, end, (vigor, at) => (vigor && at < 3 ? 10 : 7.5), [3])],
      [
        { start: 2, end: 3, rate: 10 },
        { start: 3, end, rate: 7.5 }
      ]
    );
  }
});

test('empty and reversed endurance windows bypass history with or without permanent Vigor', () => {
  // No resource time elapses, so neither history reconstruction nor profession rate queries are needed.
  const vigorWindows = () => assert.fail('Empty windows must not read event history');
  for (const vigor of [false, true]) {
    for (const [start, end] of [
      [2, 2],
      [2, 1],
      [Infinity, Infinity]
    ]) {
      assert.deepEqual(
        [...vigorEnduranceIntervals({ vigorWindows, config: { boons: { vigor } } }, start, end, () => assert.fail())],
        []
      );
    }
  }
});

test('endurance spend and grant clamp values and carry their timestamps', () => {
  assert.deepEqual(spendEndurance(clock(30, 2), 50, 4), clock(0, 4));
  assert.deepEqual(grantEndurance(clock(80, 4), 50, 6), clock(100, 6));
});

test('endurance readiness waits for the full cost and reports an unavailable zero-rate recovery', () => {
  // A real shortage waits for recovery; only floating-point arithmetic drift counts as already funded.
  assert.equal(steadyEnduranceReadyAt(49.99995, 50, 10, 5), 10.04);
  assert.equal(steadyEnduranceReadyAt(49.99995, 50, 10, 0), null);
  assert.equal(steadyEnduranceReadyAt(50 - 1e-12, 50, 10, 0), 10);
  assert.equal(steadyEnduranceReadyAt(25, 50, 10, 5), 15);
  assert.equal(steadyEnduranceReadyAt(25, 50, 10, 0), null);
});

test('endurance intervals clip settled time and ignore empty windows and uncovered gaps', () => {
  // Neither replayed time nor gaps between supplied windows can earn endurance.
  const state = Object.freeze(clock(20, 2, 45));
  const intervals = [
    { start: 0, end: 1, rate: 10 },
    { start: 1, end: 4, rate: 5 },
    { start: 4, end: 4, rate: 100 },
    { start: 4, end: 3, rate: 100 },
    { start: 6, end: 8, rate: 10 }
  ];
  assert.deepEqual(advanceEnduranceIntervals(state, intervals), clock(45, 8, 45, 10));
  assert.equal(enduranceIntervalsReadyAt(state, 40, intervals), 7);
  assert.deepEqual(advanceEnduranceIntervals(state, []), state);
  assert.equal(enduranceIntervalsReadyAt(state, 40, []), null);
  assert.deepEqual(state, clock(20, 2, 45));
});

test('endurance interval readiness agrees with advancement across partitions, expiry, and spending', () => {
  // Changing observation boundaries must preserve recovery, including affordability exactly at a rate change.
  const state = Object.freeze(clock(0, 0));
  const vigor = { start: 0, end: 2, rate: 7.5 };
  const base = { start: 2, end: 6, rate: 5 };
  const whole = advanceEnduranceIntervals(state, [vigor, base]);
  const partial = advanceEnduranceIntervals(state, [vigor, { ...base, end: 3 }]);
  assert.deepEqual(advanceEnduranceIntervals(partial, [{ ...base, start: 3 }]), whole);
  assert.deepEqual(whole, clock(35, 6, 100, 5));
  assert.equal(enduranceIntervalsReadyAt(state, 35, [vigor, base]), 6);
  function* early() {
    yield vigor;
    assert.fail('Readiness consumed an interval after the cost was funded');
  }

  assert.equal(enduranceIntervalsReadyAt(state, 15, early()), 2);
  const spent = spendEndurance(advanceEnduranceIntervals(state, [vigor]), 10, 2);
  assert.equal(enduranceIntervalsReadyAt(spent, 15, [base]), 4);
  assert.equal(advanceEnduranceIntervals(spent, [{ ...base, end: 4 }]).value, 15);
});

// The clock reports the rate active at a boundary while crediting only recovery earned before that boundary.
test('endurance observations settle once and retain the current policy rate', () => {
  const initial = Object.freeze(clock(0));
  const intervals = [
    { start: 0, end: 2, rate: 7.5 },
    { start: 2, end: Infinity, rate: 5 }
  ];
  const boundary = advanceEnduranceIntervals(initial, intervals, 2);
  assert.deepEqual(boundary, clock(15, 2, 100, 5));
  assert.deepEqual(advanceEnduranceIntervals(boundary, intervals, 2), boundary);
  assert.deepEqual(advanceEnduranceIntervals(boundary, intervals, 4), clock(25, 4, 100, 5));
  assert.deepEqual(advanceEnduranceIntervals(initial, intervals, 4), clock(25, 4, 100, 5));
  assert.deepEqual(initial, clock(0));
});

test('endurance interval readiness respects caps without predicting impossible recovery', () => {
  // A cap is an affordability limit, not merely a clamp applied after an unbounded prediction.
  const state = clock(40, 0, 50);
  const intervals = [{ start: 0, end: Infinity, rate: 5 }];
  const unreadable = new Proxy([], { get: () => assert.fail('Impossible costs must not consume intervals') });
  assert.equal(enduranceIntervalsReadyAt(state, 51, unreadable), null);
  assert.equal(enduranceIntervalsReadyAt(state, 50.00005, unreadable), null);
  assert.equal(enduranceIntervalsReadyAt(state, 50, intervals), 2);
  assert.equal(enduranceIntervalsReadyAt(state, 50, [{ start: 0, end: 1, rate: 5 }]), null);
  const capped = advanceEnduranceIntervals(state, intervals);
  assert.deepEqual(capped, clock(50, Infinity, 50, 5));
  assert.equal(enduranceIntervalsReadyAt({ ...state, value: 49.99995 }, 50, intervals), 0.04);
});

test('zero and negative endurance rates stay idle, including infinite windows', () => {
  // Prediction and advancement share the nonnegative recovery rule and never multiply zero by Infinity.
  const state = clock(20, 0);
  for (const rate of [0, -5]) {
    const idle = { start: 0, end: 2, rate };
    const recovery = { start: 2, end: Infinity, rate: 5 };
    assert.equal(enduranceIntervalsReadyAt(state, 30, [idle, recovery]), 4);
    assert.equal(advanceEnduranceIntervals(state, [idle, { ...recovery, end: 4 }]).value, 30);
    assert.equal(enduranceIntervalsReadyAt(state, 30, [{ ...idle, end: Infinity }]), null);
    assert.deepEqual(advanceEndurance(state, Infinity, rate), clock(20, Infinity));
    assert.deepEqual(advanceEnduranceIntervals(state, [{ ...idle, end: Infinity }]), clock(20, Infinity));
  }
});
