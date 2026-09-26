import assert from 'node:assert/strict';
import test from 'node:test';
import { StableEventQueue } from '#kernel/events/queue.js';
import { timedEffect } from '#gw2/platform/profession-definition/mechanics.js';
import {
  activeChargeGrants,
  consumeCharge,
  expireCharges,
  grantCharges,
  grantChargePool
} from '#gw2/platform/combat/resources/charges.js';
import { advanceDiscreteResource, resourceValueAt } from '#gw2/platform/combat/resources/clock.js';

// Use the real queue so generation, cancellation, priority, and insertion-order checks exercise dispatch together.
function harness(definition, beforeTask = () => {}) {
  const context = { state: { time: 0 }, events: [] };
  const pending = new StableEventQueue();
  let order = 0;
  const cancelled = new Set();
  const queue = {
    schedule(task) {
      const id = String(++order);
      pending.enqueue({ ...task, id });
      return id;
    },
    cancel(id) {
      cancelled.add(id);
    },
    nextAt() {
      return pending.peek()?.at ?? Infinity;
    },
    drainThrough(at, ctx) {
      while (pending.peek()?.at <= at) {
        const task = pending.dequeue();
        if (cancelled.has(task.id)) continue;
        beforeTask(task.at);
        ctx.state.time = task.at;
        definition.taskHandlers[task.type](ctx, task);
      }
    }
  };
  context.tasks = queue;
  return { context, queue, through: (at) => queue.drainThrough(at, context) };
}

test('finite effects select live state, retain captured values, and invalidate an early-consumed occurrence', () => {
  const sequence = timedEffect({
    id: 'finite',
    interval: () => 3,
    effectsAt(context, at, captured) {
      context.events.push([at, context.state.attunement, captured.source]);
    }
  });
  const { context, through } = harness(sequence);
  const captured = { source: 'command' };
  const id = sequence.start(context, { at: 3, count: 2, captured });
  captured.source = 'changed';
  context.state.attunement = 'Fire';
  sequence.consume(context, id, 1);
  context.state.attunement = 'Air';
  through(3);
  assert.deepEqual(context.events, [[1, 'Fire', 'command']]);
  through(4);
  assert.deepEqual(context.events, [
    [1, 'Fire', 'command'],
    [4, 'Air', 'command']
  ]);
  assert.equal(sequence.nextAt(context), Infinity);
});

test('replacement retires old pulses and recurrence stops at the requested observation boundary', () => {
  const sequence = timedEffect({
    id: 'recurring',
    interval: () => 2,
    effectsAt(context, at, captured) {
      context.events.push([at, captured.source]);
    }
  });
  const { context, through, queue } = harness(sequence);
  sequence.start(context, { key: 'upkeep', at: 1, captured: { source: 'old' } });
  sequence.start(context, { key: 'upkeep', at: 2, captured: { source: 'new' } });
  through(5);
  assert.deepEqual(context.events, [
    [2, 'new'],
    [4, 'new']
  ]);
  assert.equal(queue.nextAt(), 6);
  sequence.cancelKey(context, 'upkeep');
  through(10);
  assert.equal(context.events.length, 2);
});

test('timed definitions reject malformed times and nonpositive recurrence without retiring a valid lifetime', () => {
  const sequence = timedEffect({ id: 'validation', interval: () => 0, effectsAt() {} });
  const { context } = harness(sequence);
  sequence.start(context, { key: 'valid', times: [2], captured: {} });
  for (const times of [[NaN], [Infinity], [3, 2]])
    assert.throws(() => sequence.start(context, { key: 'valid', times, captured: {} }));
  assert.throws(() => sequence.start(context, { at: 1, captured: {} }), /positive/);
  assert.throws(() => sequence.start(context, { key: 'valid', times: [4], captured: { callback() {} } }));
  assert.equal(sequence.nextAt(context, 'valid'), 2);
});

test('charge refresh survives old expiry, preserves ICD, and keeps independent recipient grants isolated', () => {
  let grant = grantCharges(2, 5);
  assert.equal(consumeCharge(grant, 1, 2), true);
  grant = grantCharges(1, 10, grant, 2);
  assert.equal(consumeCharge(grant, 2, 2), false);
  expireCharges(grant, 5);
  assert.equal(consumeCharge(grant, 5, 2), true);
  assert.equal(grant.charges, 1);
  const pool = { grants: {} };
  grantChargePool(pool, 'player', 0, 2, 4);
  grantChargePool(pool, 'player', 1, 3, 6);
  grantChargePool(pool, 'ally:1', 0, 2, 4);
  assert.equal(consumeCharge(pool.grants.player[0], 2), true);
  assert.equal(pool.grants['ally:1'][0].charges, 2);
  const active = activeChargeGrants(pool.grants.player, 4);
  assert.deepEqual(
    active.map((value) => value.charges),
    [3]
  );
  active[0].charges = 1;
  assert.equal(consumeCharge(grantCharges(1, 4), 4), false);
  assert.equal(consumeCharge(grantCharges(1, 4), 4, 0, true), true);
});

test('anchored accrual queries retain their original anchor', () => {
  const anchor = { value: 10, maximum: 100, rate: 3, updatedAt: 1 };
  resourceValueAt(anchor, 2);
  assert.equal(resourceValueAt(anchor, 4), 19);
  assert.equal(anchor.value, 10, 'queries must retain the original accrual anchor');
});

test('discrete resources grant on 40 ms ticks without early tolerance or cadence drift', () => {
  // An off-grid cadence retains its phase across observations, cap overflow, and later spending.
  assert.deepEqual(advanceDiscreteResource(0, 8, 5, 5, 4.99999), { value: 0, nextAt: 5 });
  assert.deepEqual(advanceDiscreteResource(0, 8, 5, 5, 5), { value: 1, nextAt: 10 });
  assert.deepEqual(advanceDiscreteResource(8, 8, Infinity, 5, 10), { value: 8, nextAt: Infinity });
  for (const partition of [[0.2], [0.07, 0.08, 0.119, 0.12, 0.2]]) {
    let state = { value: 0, nextAt: 0.05 };
    for (const at of partition) state = advanceDiscreteResource(state.value, 8, state.nextAt, 0.05, at);
    assert.deepEqual(state, { value: 4, nextAt: 0.25 });
  }

  assert.deepEqual(advanceDiscreteResource(0, 8, 0.05, 0.05, 0.079), { value: 0, nextAt: 0.05 });
  const full = advanceDiscreteResource(8, 8, 0.05, 0.05, 0.08);
  assert.deepEqual(full, { value: 8, nextAt: 0.1 });
  assert.deepEqual(advanceDiscreteResource(7, 8, full.nextAt, 0.05, 0.1), { value: 7, nextAt: 0.1 });
  assert.deepEqual(advanceDiscreteResource(7, 8, full.nextAt, 0.05, 0.12), { value: 8, nextAt: 0.15 });
});
