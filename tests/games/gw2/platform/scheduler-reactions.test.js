import assert from 'node:assert/strict';
import test from 'node:test';
import { eventReaction, scheduledReaction } from '#gw2/platform/profession-definition/mechanics.js';
import { createTaskQueue } from '#gw2/platform/execution/tasks.js';
import { activationScopedOperations } from '#gw2/platform/execution/cast-lifecycle.js';
import { freshAirReaction, projectedFreshAirReadyAt } from '#gw2/professions/elementalist/core/traits/air.js';
import { rangerStealthReaction } from '#gw2/professions/ranger/core/mechanics/weapon-state.js';

// The real queue exercises cloning, timestamp ordering, cancellation, and observation cutoffs together.
test('event reactions use canonical replacements and preserve task priority, insertion, and owner cancellation', () => {
  const seen = [];
  const events = new Map();
  const reaction = eventReaction({
    id: 'hit',
    missingEvent: 'error',
    select: (_context, event) => ({
      at: event.at,
      priority: event.priority,
      ownerId: event.owner,
      payload: { eventOrder: event.eventOrder, captured: event.value }
    }),
    execute: (_context, event, at, payload) => seen.push([event.eventOrder, at, event.value, payload.captured])
  });
  const tasks = createTaskQueue({ handlers: reaction.taskHandlers });
  const context = { tasks, eventByOrder: (order) => events.get(order) };
  for (const [eventOrder, priority, owner, at] of [
    [1, 0, 'cast', 2],
    [2, -10, 'clone', 2],
    [3, 0, 'cast', 2],
    [4, -20, 'cancel', 2],
    [5, 0, 'cast', 3]
  ]) {
    const event = { eventOrder, priority, owner, at, value: 'observed' };
    events.set(eventOrder, { ...event, value: 'canonical' });
    reaction.onEventScheduled.handler(context, event);
    event.value = 'mutated';
  }

  tasks.cancelOwner('cancel');
  tasks.drainThrough(2, context);
  assert.deepEqual(seen, [
    [2, 2, 'canonical', 'observed'],
    [1, 2, 'canonical', 'observed'],
    [3, 2, 'canonical', 'observed']
  ]);
  assert.equal(tasks.nextAt(), 3);
  events.delete(5);
  assert.throws(() => tasks.drainThrough(3, context), /requires a scheduled event/);
});

test('missing-event skip never executes a captured event and rejected candidates never schedule', () => {
  const reaction = eventReaction({
    id: 'skip',
    missingEvent: 'skip',
    select: (_context, event) => (event.cancelled ? null : { at: 1, payload: { eventOrder: 1 } }),
    execute: () => assert.fail('Missing canonical event must not run.')
  });
  const tasks = createTaskQueue({ handlers: reaction.taskHandlers });
  const context = { tasks, eventByOrder: () => undefined };
  reaction.onEventScheduled.handler(context, { cancelled: true });
  assert.equal(tasks.nextAt(), Infinity);
  reaction.onEventScheduled.handler(context, {});
  tasks.drainThrough(1, context);
});

// Real profession selection and execution must preserve same-time ordering and replacement eligibility.
test('Ranger stealth follows its strike and skips cancelled, missing, and off-target impacts', () => {
  const core = { stealthUntil: 0, revealedUntil: 0 };
  const events = new Map();
  const tasks = createTaskQueue({ handlers: rangerStealthReaction.taskHandlers });
  const context = {
    tasks,
    state: { profession: { core } },
    eventByOrder: (order) => events.get(order)
  };
  const observe = (event) => {
    events.set(event.eventOrder, event);
    rangerStealthReaction.onEventScheduled.handler(context, event);
  };

  observe({
    eventOrder: 1,
    type: 'buff',
    kind: 'stealth',
    resolvedAudience: { includesSelf: true },
    at: 1,
    duration: 5
  });
  observe({ eventOrder: 2, type: 'damage', actorType: 'player', at: 1 });
  tasks.drainThrough(1, context);
  assert.equal(core.stealthUntil, 6);
  assert.equal(core.revealedUntil, 0);

  for (const [eventOrder, replacement] of [
    [3, { offTarget: true }],
    [4, { cancelled: true }],
    [5, null]
  ]) {
    const event = { eventOrder, type: 'damage', actorType: 'player', at: 2 };
    observe(event);
    if (replacement) events.set(eventOrder, { ...event, ...replacement });
    else events.delete(eventOrder);
  }

  observe({ eventOrder: 6, type: 'damage', actorType: 'player', at: 2, activationId: 'cancelled-cast' });
  tasks.cancelOwner('cancelled-cast');
  tasks.drainThrough(2, context);
  assert.equal(core.stealthUntil, 6);
  assert.equal(core.revealedUntil, 0);
  observe({ eventOrder: 7, type: 'damage', actorType: 'player', at: 3 });
  tasks.drainThrough(3, context);
  assert.equal(core.stealthUntil, 3);
  assert.equal(core.revealedUntil, 6);
});

test('captured reactions retain payload snapshots and activation lineage independently of cancellation owner', () => {
  const emitted = [];
  const reaction = scheduledReaction({
    id: 'captured',
    select: (_context, event) => ({ at: 1, ownerId: 'clone', payload: event }),
    execute(context, at, payload) {
      context.emit({ at, amount: payload.amount });
    }
  });
  const tasks = createTaskQueue({
    handlers: Object.fromEntries(
      Object.entries(reaction.taskHandlers).map(([id, handler]) => [
        id,
        (context, task) => {
          assert.equal(task.ownerId, 'clone');
          handler(
            {
              ...context,
              ...activationScopedOperations(context, task.payload.activationId, task.payload.activationId)
            },
            task
          );
        }
      ])
    )
  });
  const context = { tasks, emit: (event) => emitted.push(event) };
  const scoped = { ...context, ...activationScopedOperations(context, 'cast', 'cast') };
  const payload = { amount: 2 };
  reaction.onEventScheduled.handler(scoped, payload);
  payload.amount = 9;
  tasks.drainThrough(1, context);
  assert.deepEqual(emitted, [{ activationId: 'cast', at: 1, amount: 2 }]);
  assert.throws(() => reaction.onEventScheduled.handler(scoped, { callback() {} }), /serializable/);
});

test('Fresh Air shares one candidate batch with lookahead and consumes replacement critical facts once', () => {
  const core = {
    primaryAttunement: 'Water',
    freshAirProgress: 0,
    freshAirCandidates: [],
    attunementReadyAt: { Air: 10 }
  };
  const emitted = [];
  const events = new Map();
  let factsRequired = false;
  const tasks = createTaskQueue({
    handlers: Object.fromEntries(
      Object.entries(freshAirReaction.taskHandlers).map(([id, handler]) => [
        id,
        (context, task) => {
          context.state.time = task.at;
          handler(context, task);
        }
      ])
    )
  });
  const context = {
    tasks,
    state: { time: 0, cooldowns: new Map(), profession: { core, specialization: { kind: 'Core', state: {} } } },
    config: { selectedTraitIds: ['Fresh Air'], randomness: { mode: 'stochastic' } },
    schedulerPolicy: {
      requireCriticalFacts() {
        factsRequired = true;
      },
      critical() {
        assert.equal(factsRequired, true);
        return { chance: 0.5 };
      },
      rollRandom() {
        assert.fail('Fresh Air must consume the stored critical fact.');
      }
    },
    eventByOrder: (order) => events.get(order),
    emit: (event) => emitted.push(event)
  };
  for (const hook of freshAirReaction.initialize) hook.handler(context);
  for (const [eventOrder, at, didCrit] of [
    [1, 3, false],
    [2, 2, false],
    [3, 2, true]
  ]) {
    const event = { eventOrder, at, type: 'damage', actorType: 'player', coefficient: 1, didCrit: false };
    freshAirReaction.onEventScheduled.handler(context, event);
    events.set(eventOrder, { ...event, didCrit });
  }

  assert.equal(projectedFreshAirReadyAt(context, 2), 2);
  assert.equal(core.freshAirProgress, 0);
  tasks.drainThrough(2, context);
  assert.equal(core.attunementReadyAt.Air, 2);
  assert.deepEqual(
    core.freshAirCandidates.map(({ eventOrder }) => eventOrder),
    [1]
  );
  assert.equal(emitted.length, 1);
  tasks.drainThrough(3, context);
  assert.deepEqual(core.freshAirCandidates, []);
  assert.equal(emitted.length, 1);
});
