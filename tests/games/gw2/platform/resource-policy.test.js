import { createRuntimeResources } from '#gw2/platform/simulation/runtime-resources.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createResourceClock,
  createDiscreteResourceClock,
  resourceAnchor
} from '#gw2/platform/combat/resources/clock.js';
// Settle each observed clock through the production resource controller.
function advance(runtime, at) {
  runtime.time = at;
  runtime.resourceController.advance();
}

// Minimal declared pools isolate chronological resource contracts from profession effects.
function fixture(kind, config = {}, policy = {}) {
  const context = {
    time: 0,
    config,
    profession: { pool: kind === 'continuous' ? createResourceClock() : createDiscreteResourceClock() }
  };
  // Bind the policy's owned data independently of the engine controller under test.
  context.mechanics = {
    profession: context.profession,
    get config() {
      return context.config;
    },
    get time() {
      return context.time;
    }
  };
  context.resourceController = createRuntimeResources(context, {
    resources: {
      initiative: {
        kind,
        state: (runtime) => runtime.profession.pool,
        maximum: (runtime) => runtime.config.maximum ?? 10,
        initial: (runtime) => runtime.config.initial ?? 0,
        recovery: (runtime) =>
          kind === 'continuous'
            ? (runtime.config.rate ?? 1)
            : {
                interval: runtime.config.interval ?? 2,
                amount: runtime.config.amount ?? 2,
                start: runtime.config.start ?? 'immediate'
              },
        ...policy
      }
    }
  });
  context.resourceController.initialize();
  return context;
}

// Replacement validates first, settles elapsed recovery, and starts a new segment only for a real balance change.
test('replacement rejects invalid values atomically and preserves continuous recovery', () => {
  const context = fixture('continuous', { initial: 2, rate: 2 });
  const pool = context.profession.pool;
  const before = structuredClone(pool);
  context.time = 1;
  for (const value of [-1, NaN, Infinity]) {
    assert.throws(() => context.resourceController.replace('initiative', value), /finite and non-negative/);
    assert.deepEqual(pool, before);
  }

  const anchor = resourceAnchor(pool);
  context.resourceController.replace('initiative', 4);
  assert.equal(pool.value, 4);
  assert.equal(pool.updatedAt, 1);
  assert.equal(resourceAnchor(pool), anchor);
  context.resourceController.replace('initiative', 1.5);
  assert.equal(pool.rate, 2);
  assert.notEqual(resourceAnchor(pool), anchor);
  advance(context, 2);
  assert.equal(pool.value, 3.5);
  context.resourceController.replace('initiative', 100);
  assert.equal(pool.value, 10);
});

// Replacing a full idle pool starts first-spend recovery; refills and repeated replacements retain the phase.
test('replacement preserves discrete cadence and starts it only when an idle pool is lowered', () => {
  for (const start of ['immediate', 'first-spend']) {
    const context = fixture('discrete', { initial: 10, start });
    const pool = context.profession.pool;
    context.time = 3;
    context.resourceController.replace('initiative', 100);
    assert.equal(pool.nextAt, start === 'immediate' ? 4 : Infinity);
    context.resourceController.replace('initiative', 5);
    const deadline = start === 'immediate' ? 4 : 5;
    assert.equal(pool.nextAt, deadline);
    context.time = deadline;
    const anchor = resourceAnchor(pool);
    context.resourceController.replace('initiative', 7);
    assert.equal(resourceAnchor(pool), anchor);
    assert.equal(pool.nextAt, deadline + 2);
    context.resourceController.replace('initiative', 10);
    context.resourceController.replace('initiative', 10);
    context.resourceController.replace('initiative', 9);
    assert.equal(pool.nextAt, deadline + 2);
  }
});

// A no-op at a fractional observation must not make a recovery-funded threshold available before its action tick.
test('no-op replacement retains continuous readiness detection and recovery ceilings', () => {
  const context = fixture('continuous', { rate: 5 }, { recoveryMaximum: () => 6 });
  context.time = 0.1;
  const anchor = resourceAnchor(context.profession.pool);
  context.resourceController.replace('initiative', 0.5);
  assert.equal(resourceAnchor(context.profession.pool), anchor);
  assert.equal(context.resourceController.readyAt('initiative', 0.5), 0.12);
  context.resourceController.replace('initiative', 9);
  advance(context, 10);
  assert.equal(context.profession.pool.value, 9);
  assert.equal(context.profession.pool.recoveryMaximum, 6);
});

// Depletion owners receive one change notification for resets, with no false wakes for identical or disabled values.
test('replacement refreshes depletion once per changed balance and leaves disabled pools inert', () => {
  const calls = [];
  const context = fixture(
    'continuous',
    { initial: 8, rate: -1 },
    {
      depletion: { refresh: () => calls.push('refresh'), stop: () => calls.push('stop') },
      changed: (runtime) => calls.push(runtime.profession.pool.value)
    }
  );
  calls.length = 0;
  context.time = 2;
  context.resourceController.replace('initiative', 6);
  assert.deepEqual(calls, []);
  context.resourceController.replace('initiative', 0);
  assert.deepEqual(calls, ['refresh', 0]);
  calls.length = 0;
  context.config = { maximum: 0, rate: 0 };
  context.resourceController.refresh('initiative');
  assert.deepEqual(calls, ['stop', 0]);
  calls.length = 0;
  context.resourceController.replace('initiative', 100);
  assert.deepEqual(calls, []);
  assert.equal(context.profession.pool.value, 0);
});

test('continuous recovery, pure readiness, and split waits agree', () => {
  for (const waits of [[3], [0.2, 1.3, 3]]) {
    const context = fixture('continuous');
    const pool = context.profession.pool;
    assert.equal(context.resourceController.readyAt('initiative', 4), 4);
    assert.equal(pool.value, 0);
    for (const at of waits) advance(context, at);
    assert.equal(pool.value, 3);
    context.resourceController.grant('initiative', 2);
    context.resourceController.spend('initiative', 4);
    assert.equal(pool.value, 1);
    assert.equal(context.resourceController.readyAt('initiative', 11), null);
  }
});

test('discrete recovery preserves cadence at cap and starts idle pools on spending', () => {
  for (const start of ['immediate', 'first-spend']) {
    const context = fixture('discrete', { initial: 10, start });
    advance(context, 3);
    context.resourceController.spend('initiative', 5);
    const first = start === 'immediate' ? 4 : 5;
    assert.equal(context.resourceController.readyAt('initiative', 10), first + 4);
    context.resourceController.grant('initiative', 100);
    advance(context, first);
    assert.equal(context.profession.pool.nextAt, first + 2);
    context.resourceController.spend('initiative', 1);
    assert.equal(context.profession.pool.nextAt, first + 2);
  }
});

test('rate and capacity changes settle the previous segment without refilling', () => {
  const context = fixture('continuous', { initial: 8, rate: -1, maximum: 10 });
  advance(context, 2);
  context.config = { rate: 2, maximum: 20 };
  context.resourceController.refresh('initiative');
  assert.equal(context.profession.pool.value, 6);
  advance(context, 3);
  assert.equal(context.profession.pool.value, 8);
  context.config = { rate: 0, maximum: 5 };
  context.resourceController.refresh('initiative');
  assert.equal(context.profession.pool.value, 5);
});

test('invalid grants and unaffordable costs leave state untouched', () => {
  const context = fixture('continuous', { initial: 2 });
  const before = structuredClone(context.profession.pool);
  for (const amount of [-1, NaN, Infinity]) assert.throws(() => context.resourceController.grant('initiative', amount));
  assert.throws(() => context.resourceController.spend('initiative', 3), /Insufficient/);
  assert.deepEqual(context.profession.pool, before);
});

test('no-op mutations and intermediate reads cannot release recovery-funded costs before their detection tick', () => {
  const context = fixture('continuous', { rate: 5 });
  advance(context, 0.1);
  context.resourceController.grant('initiative', 0);
  context.resourceController.spend('initiative', 0);
  context.resourceController.refresh('initiative');
  const before = structuredClone(context.profession.pool);
  assert.equal(context.resourceController.readyAt('initiative', 0.5), 0.12);
  assert.deepEqual(context.profession.pool, before);
});

test('resource initialization rejects invalid tuning and permits disabled pools without depletion loops', () => {
  for (const config of [{ maximum: NaN }, { maximum: -1 }, { initial: Infinity }, { rate: Infinity }]) {
    assert.throws(() => fixture('continuous', config));
  }

  for (const config of [{ interval: Infinity }, { interval: -1 }, { interval: 0.0000001 }, { amount: -1 }]) {
    assert.throws(() => fixture('discrete', config));
  }

  const context = fixture('continuous', { maximum: 0, rate: -1 });
  advance(context, 10);
  assert.equal(context.profession.pool.value, 0);
  assert.equal(context.resourceController.readyAt('initiative', 1), null);
});
