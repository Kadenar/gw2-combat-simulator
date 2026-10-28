import assert from 'node:assert/strict';
import test from 'node:test';

import { HandlerRegistry } from '#gw2/platform/resolver/handler-registry.js';
import { createExecutionCoordinator } from '#gw2/platform/simulation/coordinator.js';
import { createInternalWorkFactory } from '#gw2/platform/simulation/internal-work.js';
import { isRuntimeWork } from '#gw2/platform/simulation/work-contract.js';
import { StableEventQueue } from '#kernel/events/queue.js';

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
  const queue = new StableEventQueue();
  queue.enqueue(old);
  queue.cancelWhere((work) => work.owner.id === 'pet' && work.owner.generation === 1);
  const renewed = create({ ...input, payload: { amount: 3 } });
  const projectile = create({ ...input, owner: { id: 'projectile', generation: 1 }, payload: { amount: 4 } });
  queue.enqueue(renewed);
  queue.enqueue(projectile);
  const state = { resource: 0 };
  while (queue.peek()) handlers.dispatch(queue.dequeue(), state);
  assert.equal(state.resource, 7);
  assert.throws(() => create({ ...input, type: 'missing' }), /handler registered/);
  assert.throws(() => create({ ...input, at: Infinity }), /microseconds/);
  assert.throws(() => create({ ...input, priority: NaN }), /priority/);
  assert.throws(() => create({ ...input, payload: { callback() {} } }), /serializable/);
  assert.throws(() => create({ ...input, owner: { id: 'pet', generation: -1 } }), /generation/);
});

// Mixed scheduling retains work causes and packet cancellation handles without giving work a public identity.
test('coordinator schedules real work and packets on one heap with separate capabilities', () => {
  const coordinator = createExecutionCoordinator(() => ({ time: 0 }));
  const handlers = new HandlerRegistry().register('runtime.task', () => {});
  const create = createInternalWorkFactory(handlers);
  const cause = { type: 'action', at: 0, source: 'Cast', sourceId: 1, actorType: 'player', eventOrder: 1 };
  const task = (name, generation) =>
    create({
      type: 'runtime.task',
      at: 1,
      priority: 0,
      payload: { name, data: null },
      owner: { id: 'actor', generation }
    });
  const old = task('attack', 1);
  const renewed = task('attack', 2);
  const ambient = task('ambient', 2);
  coordinator.withCause(cause, () => {
    coordinator.enqueueWork(old);
    coordinator.enqueueWork(renewed);
    coordinator.enqueueWork(ambient, true);
  });
  coordinator.queue.cancelWhere((entry) => isRuntimeWork(entry) && entry.owner.generation === 1);
  const packet = coordinator.packets.enqueue({
    type: 'damage',
    at: 1,
    source: 'Hit',
    sourceId: 1,
    actorType: 'player',
    coefficient: 1,
    priority: 1
  });
  const cancelled = coordinator.packets.enqueue({ ...packet, at: 2 });
  coordinator.packets.cancel(cancelled);
  assert.deepEqual(coordinator.pendingEffects([]), [
    { at: 1, cause },
    { at: 1, cause: packet }
  ]);
  assert.deepEqual(coordinator.pendingEffects([], ['attack']), [{ at: 1, cause: packet }]);
  assert.equal(coordinator.queue.dequeue(), renewed);
  assert.equal(coordinator.workCause(renewed), cause);
  assert.equal(coordinator.queue.dequeue(), ambient);
  assert.equal(coordinator.workCause(ambient), undefined);
  assert.equal(coordinator.queue.dequeue(), packet);
  assert.equal(coordinator.queue.dequeue(), undefined);
  for (const key of ['source', 'sourceId', 'actorType', 'eventOrder']) assert.equal(key in renewed, false);
  assert.ok(packet.eventOrder > 0);
  assert.equal('dequeue' in coordinator.packets, false);
  assert.throws(() => coordinator.packets.enqueue(old), /work factory/);
});

// Internal reactions scheduled during condition settlement stay in that phase before ordinary damage.
test('work and packet scheduling share the current settlement phase and causal order', () => {
  const coordinator = createExecutionCoordinator(() => ({ time: 1 }));
  const handlers = new HandlerRegistry().register('runtime.task', () => {});
  const create = createInternalWorkFactory(handlers);
  const pulse = coordinator.packets.enqueue({
    type: 'condition_tick',
    at: 1,
    source: 'Condition',
    sourceId: 'pulse',
    actorType: 'player',
    causalOrder: 7
  });
  assert.equal(coordinator.queue.dequeue(), pulse);
  const work = create({ type: 'runtime.task', at: 1, priority: 0, payload: { name: 'reaction', data: null } });
  coordinator.withCause(pulse, () => coordinator.enqueueWork(work));
  const hit = coordinator.packets.enqueue({
    type: 'damage',
    at: 1,
    source: 'Hit',
    sourceId: 1,
    actorType: 'player',
    coefficient: 1,
    priority: -100
  });
  assert.equal(hit.causalOrder, 7);
  assert.equal(coordinator.queue.dequeue(), work);
  assert.equal(coordinator.packets.currentPhase, 1);
  assert.equal(coordinator.queue.dequeue(), hit);
  assert.equal(coordinator.packets.currentPhase, 2);
});
