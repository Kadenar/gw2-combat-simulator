import assert from 'node:assert/strict';
import test from 'node:test';
import { defineProfession } from '#gw2/platform/engine/profession/contract.js';
import { createScheduler } from '#gw2/platform/execution/scheduler.js';
import {
  createResourceClock,
  createDiscreteResourceClock,
  grantResource,
  spendResource,
  refreshResource,
  resourceReadyAt
} from '#gw2/platform/combat/resources/resource-policy.js';
import { resourceDepletion } from '#gw2/platform/execution/resource-clock.js';

// Minimal declared pools isolate chronological resource contracts from profession effects.
function fixture(kind, config = {}, policy = {}) {
  return createScheduler({
    config,
    profession: defineProfession({
      id: 'resource-fixture',
      name: 'Resource fixture',
      resources: {
        createProfessionState: () => ({
          pool: kind === 'continuous' ? createResourceClock() : createDiscreteResourceClock()
        }),
        initiative: {
          kind,
          state: (context) => context.state.profession.pool,
          maximum: (context) => context.config.maximum ?? 10,
          initial: (context) => context.config.initial ?? 0,
          recovery: (context) =>
            kind === 'continuous'
              ? (context.config.rate ?? 1)
              : {
                  interval: context.config.interval ?? 2,
                  amount: context.config.amount ?? 2,
                  start: context.config.start ?? 'immediate'
                },
          ...policy
        }
      },
      schedulerHooks: { taskHandlers: policy.depletion?.taskHandlers }
    })
  });
}

test('continuous recovery, pure readiness, and split waits agree', () => {
  for (const waits of [[3], [0.2, 1.3, 3]]) {
    const { context } = fixture('continuous');
    const pool = context.state.profession.pool;
    assert.equal(resourceReadyAt(context, 'initiative', 4), 4);
    assert.equal(pool.value, 0);
    for (const at of waits) context.advanceTo(at);
    assert.equal(pool.value, 3);
    grantResource(context, 'initiative', 2);
    spendResource(context, 'initiative', 4);
    assert.equal(pool.value, 1);
    assert.equal(resourceReadyAt(context, 'initiative', 11), null);
  }
});

test('discrete recovery preserves cadence at cap and starts idle pools on spending', () => {
  for (const start of ['immediate', 'first-spend']) {
    const { context } = fixture('discrete', { initial: 10, start });
    context.advanceTo(3);
    spendResource(context, 'initiative', 5);
    const first = start === 'immediate' ? 4 : 5;
    assert.equal(resourceReadyAt(context, 'initiative', 10), first + 4);
    grantResource(context, 'initiative', 100);
    context.advanceTo(first);
    assert.equal(context.state.profession.pool.nextAt, first + 2);
    spendResource(context, 'initiative', 1);
    assert.equal(context.state.profession.pool.nextAt, first + 2);
  }
});

test('rate and capacity changes settle the previous segment without refilling', () => {
  const { context } = fixture('continuous', { initial: 8, rate: -1, maximum: 10 });
  context.advanceTo(2);
  context.config = { rate: 2, maximum: 20 };
  refreshResource(context, 'initiative');
  assert.equal(context.state.profession.pool.value, 6);
  context.advanceTo(3);
  assert.equal(context.state.profession.pool.value, 8);
  context.config = { rate: 0, maximum: 5 };
  refreshResource(context, 'initiative');
  assert.equal(context.state.profession.pool.value, 5);
});

test('invalid grants and unaffordable costs leave state untouched', () => {
  const { context } = fixture('continuous', { initial: 2 });
  const before = structuredClone(context.state.profession.pool);
  for (const amount of [-1, NaN, Infinity]) assert.throws(() => grantResource(context, 'initiative', amount));
  assert.throws(() => spendResource(context, 'initiative', 3), /Insufficient/);
  assert.deepEqual(context.state.profession.pool, before);
});

// Pending mutations are retry boundaries, never credits until their owned task actually executes.
test('future grants respect ownership, observation windows, and chronological caps', () => {
  const { context } = fixture('continuous', { initial: 8, rate: -1 });
  grantResource({ ...context, reservationId: 'cancelled' }, 'initiative', 5, 2);
  assert.equal(resourceReadyAt(context, 'initiative', 9), 2);
  context.tasks.cancelOwner('cancelled');
  assert.equal(resourceReadyAt(context, 'initiative', 9), null);
  grantResource(context, 'initiative', 5, 3);
  context.advanceTo(2);
  assert.equal(context.state.profession.pool.value, 6);
  context.advanceTo(4);
  assert.equal(context.state.profession.pool.value, 9);
  assert.throws(() => grantResource(context, 'initiative', 1, 3), /precede/);
  assert.throws(() => grantResource(context, 'initiative', 1, Infinity), /finite/);
});

test('disabled discrete recovery retries only known grants and preserves a pending pulse across rate changes', () => {
  const { context } = fixture('discrete', { interval: 0 });
  assert.equal(resourceReadyAt(context, 'initiative', 2), null);
  grantResource(context, 'initiative', 1, 1);
  assert.equal(resourceReadyAt(context, 'initiative', 2), 1);
  context.advanceTo(1);
  context.config = { interval: 3 };
  refreshResource(context, 'initiative');
  assert.equal(context.state.profession.pool.nextAt, 4);
  context.advanceTo(2);
  context.config = { interval: 1 };
  refreshResource(context, 'initiative');
  assert.equal(context.state.profession.pool.nextAt, 4);
  context.advanceTo(4);
  assert.equal(context.state.profession.pool.value, 3);
  assert.equal(context.state.profession.pool.nextAt, 5);
});

test('no-op mutations and intermediate reads cannot release recovery-funded costs before their detection tick', () => {
  const { context } = fixture('continuous', { rate: 5 });
  context.advanceTo(0.1);
  grantResource(context, 'initiative', 0);
  spendResource(context, 'initiative', 0);
  refreshResource(context, 'initiative');
  const before = structuredClone(context.state.profession.pool);
  assert.equal(resourceReadyAt(context, 'initiative', 0.5), 0.12);
  assert.deepEqual(context.state.profession.pool, before);
});

test('depletion re-arms after grants, honors equal-time priority, and fires once', () => {
  for (const priority of [-1, 1]) {
    const exits = [];
    const depletion = resourceDepletion({
      id: 'fixture.depletion',
      priority,
      clock: (context) => context.state.profession.pool,
      depleted(context, at) {
        exits.push(at);
        context.config = { ...context.config, rate: 0 };
        refreshResource(context, 'initiative');
      }
    });
    const { context } = fixture('continuous', { initial: 2, rate: -1 }, { depletion });
    grantResource(context, 'initiative', 1, 2);
    context.advanceTo(4);
    assert.deepEqual(exits, [priority < 0 ? 2 : 3]);
    context.advanceTo(8);
    assert.equal(exits.length, 1);
  }
});

test('resource initialization rejects invalid tuning and permits disabled pools without depletion loops', () => {
  for (const config of [{ maximum: NaN }, { maximum: -1 }, { initial: Infinity }, { rate: Infinity }]) {
    assert.throws(() => fixture('continuous', config));
  }

  for (const config of [{ interval: Infinity }, { interval: -1 }, { interval: 0.0000001 }, { amount: -1 }]) {
    assert.throws(() => fixture('discrete', config));
  }

  const depletion = resourceDepletion({
    id: 'disabled',
    clock: (context) => context.state.profession.pool,
    depleted: () => assert.fail('Disabled pool depleted')
  });
  const { context } = fixture('continuous', { maximum: 0, rate: -1 }, { depletion });
  context.advanceTo(10);
  assert.equal(context.state.profession.pool.value, 0);
  assert.equal(resourceReadyAt(context, 'initiative', 1), null);
});

test('a scheduled capacity increase is a retry boundary without refilling the pool', () => {
  const { context } = fixture('continuous', { initial: 4, maximum: 5 });
  context.config = { maximum: 10, rate: 1 };
  refreshResource(context, 'initiative', true, 2);
  assert.equal(resourceReadyAt(context, 'initiative', 7), 2);
  context.advanceTo(2);
  assert.equal(context.state.profession.pool.value, 5);
  assert.equal(resourceReadyAt(context, 'initiative', 7), 4);
});
