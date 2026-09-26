import assert from 'node:assert/strict';
import test from 'node:test';
import { StableEventQueue } from '#kernel/events/queue.js';
import { HandlerRegistry } from '#gw2/platform/resolver/handler-registry.js';
import { createInternalWorkFactory } from '#gw2/platform/simulation/internal-work.js';

// Internal handlers use detached data on the common heap, with explicit lifetime cancellation and cast attribution.
test('internal work validates its boundary and dispatches renewed owners without reviving stale work', () => {
  const handlers = new HandlerRegistry().register('grant', (state, work) => {
    state.resource += work.payload.amount;
  });
  const create = createInternalWorkFactory(handlers);
  const input = {
    type: 'grant',
    at: 0.56 + 0.04,
    priority: 0,
    payload: { amount: 2 },
    owner: { id: 'pet', generation: 1 },
    activationId: 'cast:1'
  };
  const old = create(input);
  input.payload.amount = 99;
  input.owner.generation = 2;
  assert.equal(old.at, 0.6);
  assert.equal(old.payload.amount, 2);
  assert.equal(old.owner.generation, 1);
  assert.throws(() => {
    old.at = 2;
  }, TypeError);
  const queue = new StableEventQueue([old]);
  queue.cancelWhere((work) => work.owner.id === 'pet' && work.owner.generation === 1);
  const renewed = create({ ...input, payload: { amount: 3 } });
  const projectile = create({ ...input, owner: { id: 'projectile', generation: 1 }, payload: { amount: 4 } });
  queue.enqueue(renewed);
  queue.enqueue(projectile);
  assert.notEqual(old.id, renewed.id);
  assert.notEqual(renewed.id, projectile.id);
  const state = { resource: 0 };
  while (queue.peek()) handlers.dispatch(queue.dequeue(), state);
  assert.equal(state.resource, 7);
  assert.throws(() => create({ ...input, type: 'missing' }), /handler registered/);
  assert.throws(() => create({ ...input, at: Infinity }), /microseconds/);
  assert.throws(() => create({ ...input, priority: NaN }), /priority/);
  assert.throws(() => create({ ...input, payload: { callback() {} } }), /serializable/);
  assert.throws(() => create({ ...input, owner: { id: 'pet', generation: -1 } }), /generation/);
});
