import { createRuntimeResources } from '#gw2/platform/simulation/runtime-resources.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { StableEventQueue } from '#kernel/events/queue.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { validateResourcePolicies } from '#gw2/platform/combat/resources/resource-policy.js';
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
  const queue = new StableEventQueue();
  const context = {
    time: 0,
    config,
    queue,
    // Exercise the production queue's ordering and cancellation rather than a second scheduler implementation.
    schedule(name, at, data, owner, priority) {
      queue.enqueue({ name, at, data, owner, priority });
    },
    cancelOwner(owner) {
      queue.cancelWhere((event) => event.owner?.id === owner.id && event.owner.generation === owner.generation);
    },
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
  const profession = {
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
  };
  validateResourcePolicies(profession.resources);
  context.resourceController = createRuntimeResources(context, profession);
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

// Changed balances replace the owned deadline; no-op replacements and disabled pools cannot leave false wakes.
test('replacement refreshes depletion once per changed balance and leaves disabled pools inert', () => {
  const calls = [];
  const context = fixture(
    'continuous',
    { initial: 8, rate: -1 },
    {
      depletion: { task: 'depleted', priority: -300 },
      changed: (runtime) => calls.push(runtime.profession.pool.value)
    }
  );
  calls.length = 0;
  const original = context.queue.peek();
  assert.equal(original.at, 8);
  context.time = 2;
  context.resourceController.replace('initiative', 6);
  assert.deepEqual(calls, []);
  assert.equal(context.queue.peek(), original);
  context.resourceController.replace('initiative', 0);
  assert.deepEqual(calls, [0]);
  assert.equal(context.queue.pending().length, 1);
  assert.equal(context.queue.peek().at, 2);
  assert.notEqual(context.queue.peek().owner.generation, original.owner.generation);
  calls.length = 0;
  context.config = { maximum: 0, rate: 0 };
  context.resourceController.refresh('initiative');
  assert.deepEqual(calls, [0]);
  assert.deepEqual(context.queue.pending(), []);
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

test('discrete readiness and settlement share earned grants without mutating observations', () => {
  // A forecast includes already-earned grants and retains the same phase across partitioned observations.
  for (const waits of [[0.2], [0.12, 0.159, 0.16, 0.2]]) {
    const context = fixture('discrete', { interval: 0.05, amount: 2, maximum: 10 });
    const pool = context.profession.pool;
    context.time = 0.12;
    const before = structuredClone(pool);
    assert.equal(context.resourceController.value('initiative'), 4);
    assert.equal(context.resourceController.readyAt('initiative', 8), 0.2);
    assert.deepEqual(pool, before);
    for (const at of waits) advance(context, at);
    assert.equal(pool.value, 8);
    assert.equal(pool.nextAt, 0.25);
    assert.equal(context.resourceController.readyAt('initiative', 8), 0.2);
    assert.equal(context.resourceController.readyAt('initiative', 10), 0.28);
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

// Drive resource mutations and exhaustion through the real queue, including inclusive observation endpoints.
function runThrough(context, end, tasks) {
  while (context.queue.peek()?.at <= end) {
    const event = context.queue.dequeue();
    advance(context, event.at);
    tasks[event.name](context);
  }

  advance(context, end);
}

test('grants, spending, and drain changes replace depletion without leaving stale work', () => {
  const context = fixture('continuous', { initial: 8, rate: -2 }, { depletion: { task: 'depleted', priority: -300 } });
  assert.equal(context.queue.peek().at, 4);
  advance(context, 1);
  context.resourceController.grant('initiative', 2);
  assert.equal(context.queue.peek().at, 5);
  context.resourceController.spend('initiative', 4);
  assert.equal(context.queue.peek().at, 3);
  context.config.rate = -4;
  context.resourceController.refresh('initiative');
  assert.equal(context.queue.peek().at, 2);
  assert.equal(context.queue.pending().length, 1);
  const exits = [];
  runThrough(context, 6, {
    depleted(runtime) {
      exits.push(runtime.time);
      runtime.config.rate = 0;
      runtime.resourceController.refresh('initiative');
    }
  });
  assert.deepEqual(exits, [2]);
  assert.deepEqual(context.queue.pending(), []);
});

test('stopping drain cancels the old lifetime while re-entry owns a fresh depletion wake', () => {
  const context = fixture('continuous', { initial: 4, rate: -2 }, { depletion: { task: 'depleted', priority: -10 } });
  advance(context, 1);
  context.config.rate = 0;
  context.resourceController.refresh('initiative');
  assert.deepEqual(context.queue.pending(), []);
  context.resourceController.grant('initiative', 6);
  context.config.rate = -2;
  context.resourceController.refresh('initiative');
  assert.equal(context.queue.peek().at, 5);
  runThrough(context, 2, { depleted: () => assert.fail('An obsolete wake ended the new lifetime') });
  assert.equal(context.queue.peek().at, 5);
  assert.equal(context.profession.pool.value, 6);
});

test('fractional depletion keeps action-tick detection across intermediate reads and refreshes', () => {
  const context = fixture(
    'continuous',
    { initial: 4.01, rate: -1 },
    { depletion: { task: 'depleted', priority: -300 } }
  );
  for (const at of [0.1, 1.333333, 4.01]) {
    advance(context, at);
    context.resourceController.refresh('initiative');
    assert.equal(context.queue.peek().at, 4.04);
    assert.equal(context.queue.pending().length, 1);
  }
});

test('same-time resource gains respect each depletion task priority', () => {
  for (const priority of [-300, -10, 0]) {
    for (const gainFirst of [true, false]) {
      const context = fixture('continuous', { initial: 4, rate: -2 }, { depletion: { task: 'depleted', priority } });
      const exits = [];
      context.schedule('gain', 2, null, undefined, priority + (gainFirst ? -1 : 1));
      const tasks = {
        gain: (runtime) => runtime.resourceController.grant('initiative', 4),
        depleted(runtime) {
          exits.push(runtime.time);
          runtime.config.rate = 0;
          runtime.resourceController.refresh('initiative');
        }
      };
      runThrough(context, 2, tasks);
      assert.deepEqual(exits, gainFirst ? [] : [2]);
      assert.equal(context.profession.pool.value, 4);
      runThrough(context, 4, tasks);
      assert.deepEqual(exits, gainFirst ? [4] : [2]);
    }
  }
});

test('exact lifetime limits retain unchanged deadlines and yield to earlier depletion', () => {
  const context = fixture(
    'continuous',
    { initial: 8, rate: -1, active: true, endsAt: 3.015 },
    {
      depletion: {
        task: 'depleted',
        priority: 0,
        retainUnchangedDeadline: true,
        deadline: (runtime, zeroAt) =>
          runtime.config.active ? canonicalTime(Math.min(runtime.config.endsAt, zeroAt)) : Infinity
      }
    }
  );
  const original = context.queue.peek();
  assert.equal(original.at, 3.015);
  advance(context, 1);
  context.resourceController.grant('initiative', 2);
  assert.equal(context.queue.peek(), original);
  context.resourceController.spend('initiative', 8.5);
  assert.equal(context.queue.peek().at, 1.5);
  context.config.active = false;
  context.resourceController.refresh('initiative');
  assert.deepEqual(context.queue.pending(), []);
  context.config.active = true;
  context.resourceController.grant('initiative', 9);
  assert.equal(context.queue.peek().at, 3.015);
  assert.notEqual(context.queue.peek(), original);
  context.config.rate = 0;
  context.resourceController.refresh('initiative');
  assert.equal(context.queue.peek().at, 3.015, 'A lifetime limit remains active even without resource drain');
  context.config.maximum = 0;
  context.resourceController.refresh('initiative');
  assert.deepEqual(context.queue.pending(), [], 'Disabled resources cannot schedule lifetime exits');
});

test('depletion policies reject invalid declarations and deadlines', () => {
  for (const depletion of [
    { task: '', priority: 0 },
    { task: 'depleted', priority: Infinity },
    { task: 'depleted', priority: 0, deadline: 5 },
    { task: 'depleted', priority: 0, retainUnchangedDeadline: 'yes' }
  ])
    assert.throws(() => fixture('continuous', {}, { depletion }), /Resource depletion/);
  assert.throws(() => fixture('discrete', {}, { depletion: { task: 'depleted', priority: 0 } }), /Resource depletion/);
  for (const at of [NaN, -Infinity, -1])
    assert.throws(
      () => fixture('continuous', {}, { depletion: { task: 'depleted', priority: 0, deadline: () => at } }),
      /Invalid depletion deadline/
    );
});
