import { createRuntimeResources } from '#gw2/platform/combat/resources/runtime-resources.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createResourceClock, createDiscreteResourceClock } from '#gw2/platform/combat/resources/resource-policy.js';
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
