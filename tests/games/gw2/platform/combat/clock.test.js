import assert from 'node:assert/strict';
import test from 'node:test';

import { gw2Event, gw2Interval, gw2Time } from '#gw2/platform/combat/clock.js';
import { definePeriodicTask } from '#gw2/platform/simulation/periodic-task.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { createPeriodicTaskState } from '#kernel/execution/periodic-task.js';
import { wait } from '#tests/helpers/commands.js';
import { runThief, thiefHit } from '#tests/helpers/thief-simulation.js';

// Game policy advances to an eligible tick without changing kernel precision or exact-boundary ordering.
test('GW2 clock rounds forward, preserves exact ticks and leaves the kernel game-neutral', () => {
  for (const [input, expected] of [
    [0.001, 0.04],
    [0.04, 0.04],
    [0.040001, 0.08],
    [-0.041, -0.04],
    [76.03999999999999, 76.04]
  ]) {
    assert.equal(gw2Time(input), expected);
    assert.equal(gw2Time(gw2Time(input)), expected);
  }

  assert.equal(canonicalTime(0.001), 0.001);
  assert.equal(gw2Interval(0.001), 0.04);
  assert.equal(gw2Time(Infinity), Infinity);
  assert.throws(() => gw2Time(NaN), RangeError);
  assert.throws(() => gw2Interval(0), RangeError);
  assert.throws(() => gw2Event({ at: Infinity }), RangeError);
});

// A periodic owner stores the delivered tick, so rounding cannot invalidate its generation claim.
test('GW2 periodic tasks keep their deadline and delivery on the same grid', () => {
  const state = createPeriodicTaskState();
  const scheduled = [];
  const delivered = [];
  const context = { time: 0, schedule: (...args) => scheduled.push(args), cancelOwner() {} };
  const loop = definePeriodicTask({
    name: 'grid-loop',
    background: true,
    priority: 0,
    state: () => state,
    nextAt: (runtime) => runtime.time + 0.001,
    run: (runtime) => delivered.push(runtime.time)
  });
  loop.restart(context, 0.001);
  assert.equal(state.nextAt, 0.04);
  const [name, at, generation] = scheduled.shift();
  context.time = at;
  loop.hooks.tasks[name](context, generation);
  assert.deepEqual(delivered, [0.04]);
  assert.equal(state.nextAt, 0.08);
  loop.stop(context);
  assert.equal(state.nextAt, Infinity);
});

// Packet admission, natural expiries and the observation horizon must agree even with fractional input durations.
test('GW2 simulation admits packets and expires effects only on 40 ms boundaries', () => {
  const result = runThief(
    [wait(1001)],
    {},
    {
      initialize(runtime) {
        runtime.effects.emit({ kind: 'packet', event: thiefHit(0.001) });
        for (const event of [
          { type: 'condition', condition: 'Bleeding' },
          { type: 'buff', kind: 'might', audience: { recipients: 'self' } }
        ])
          runtime.effects.emit({
            kind: 'packet',
            event: {
              at: 0.001,
              duration: 0.041,
              stacks: 1,
              source: 'fixture',
              sourceId: 'grid',
              actorType: 'player',
              ...event
            }
          });
      }
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(result.observationEndTime, 1.04);
  for (const event of result.resolvedEvents) {
    for (const key of ['at', 'expiresAt', 'naturalExpiresAt', 'removedAt']) {
      if (Number.isFinite(event[key])) assert.equal(Math.round(event[key] * 1_000_000) % 40_000, 0, key);
    }
  }

  const bleeding = result.resolvedEvents.find((event) => event.condition === 'Bleeding');
  assert.equal(bleeding.at, 0.04);
  assert.equal(bleeding.naturalExpiresAt, 0.12);
});
