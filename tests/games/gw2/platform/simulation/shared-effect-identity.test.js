import assert from 'node:assert/strict';
import test from 'node:test';

import { composeRuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { createExecutionCoordinator } from '#gw2/platform/simulation/coordinator.js';
import { runGw2Runtime } from '#gw2/platform/simulation/runtime.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { testProfession } from '#tests/fixtures/profession.js';

const packet = (sourceId, at) => ({
  type: 'buff',
  kind: 'ownership-fixture',
  duration: 2,
  stacks: 1,
  source: 'Fixture',
  sourceId,
  actorType: 'player',
  at
});

// Requeueing preserves identity, while a fresh emission of the same payload reserves a distinct place in its chain.
test('coordinator distinguishes fresh emissions from identified packets and shared condition wakes', () => {
  const coordinator = createExecutionCoordinator(() => ({ time: 0 }));
  const original = coordinator.identify(packet('original', 0));
  assert.equal(original.causalOrder, original.eventOrder);
  assert.equal(coordinator.identify(original), original);
  const requeued = coordinator.packets.enqueue(original);
  assert.equal(requeued.eventOrder, original.eventOrder);
  assert.equal(requeued.causalOrder, original.causalOrder);

  for (const type of ['condition_tick', 'condition_buffer']) {
    const pulse = { type, at: 0 };
    assert.equal(coordinator.identify(pulse), pulse);
    assert.equal(coordinator.packets.enqueue(pulse).eventOrder, undefined);
  }

  assert.equal(coordinator.eventOrder(), original.eventOrder);

  const fresh = coordinator.allocateIdentity(original);
  assert.equal(fresh.eventOrder, original.eventOrder + 1);
  assert.equal(fresh.causalOrder, original.causalOrder);
  assert.equal(original.eventOrder, requeued.eventOrder);
});

// Causal parents describe reactions, without assigning another cast or a scheduled summon loop to the current hit.
test('coordinator preserves explicit attribution and distinguishes continuations from reactions', () => {
  const coordinator = createExecutionCoordinator(() => ({ time: 0 }));
  const cause = coordinator.identify({ ...packet('skill', 0), activationId: 'cast:1' });
  const otherCast = coordinator.identify({ ...packet('other', 0), type: 'action', activationId: 'cast:2' });
  coordinator.recordAction(otherCast.activationId, otherCast);
  coordinator.queue.currentCausalOrder = cause.causalOrder;

  coordinator.withCause(cause, () => {
    const reaction = coordinator.allocateIdentity(packet('proc', 0));
    assert.equal(reaction.parentEventOrder, cause.eventOrder);
    assert.equal(reaction.causalOrder, cause.causalOrder);
    const explicit = coordinator.allocateIdentity({
      ...packet('explicit', 0),
      parentEventOrder: otherCast.eventOrder,
      causalOrder: otherCast.causalOrder
    });
    assert.equal(explicit.parentEventOrder, otherCast.eventOrder);
    assert.equal(explicit.causalOrder, otherCast.causalOrder);
    assert.equal(coordinator.allocateIdentity(cause).parentEventOrder, undefined);
    assert.equal(coordinator.allocateIdentity(otherCast).parentEventOrder, undefined);
    assert.equal(
      coordinator.allocateIdentity({ ...packet('pet', 0), actorType: 'summon' }).parentEventOrder,
      cause.eventOrder
    );
    for (const type of ['condition_tick', 'condition_buffer'])
      assert.equal(coordinator.identify({ type, at: 0 }).parentEventOrder, undefined);
  });
  coordinator.withCause(
    cause,
    () =>
      assert.equal(
        coordinator.allocateIdentity({ ...packet('pet', 0), actorType: 'summon' }).parentEventOrder,
        undefined
      ),
    true
  );
});

// Suppression consumes the reserved identity; submitting a copied receipt must not reuse its predecessor's identity.
test('delivery reserves fresh identities before suppression and preserves authored causal attribution', () => {
  const references = [];
  const catalog = createCanonicalCatalog({ skills: [] });
  const profession = {
    calculations: testProfession.calculations,
    id: 'identity-admission-fixture',
    buffPolicies: () => [{ kind: 'ownership-fixture' }],
    catalog,
    skillSelectionCatalog: catalog,
    triggerListeners: new Map(),
    projectPlanningState: () => ({}),
    createState: () => ({}),
    initialize(runtime) {
      const emit = (event, delivery = {}) => {
        const receipt = runtime.effects.emit({ kind: 'packet', receipt: true, event, ...delivery });
        references.push(receipt);
        return receipt;
      };

      const original = emit(packet('original', 0));
      emit(packet('suppressed', 0));
      emit(packet('cancelled', 1), { cast: { activationId: 'cast:cancelled', skillId: 'cancelled', effectiveEnd: 0 } });
      emit({ ...original, sourceId: 'fresh', parentEventOrder: original.eventOrder });
    },
    prepareEvent(_runtime, event) {
      return event.sourceId === 'suppressed' ? null : event;
    }
  };
  const result = runGw2Runtime({ profession, config: {}, rotation: [{ type: 'wait', durationMs: 1100 }] });
  assert.deepEqual(result.warnings, []);
  for (let index = 1; index < references.length; index++)
    assert.equal(references[index].eventOrder, references[index - 1].eventOrder + 1);
  const original = references[0];
  const fresh = result.events.find((event) => event.sourceId === 'fresh');
  assert.equal(fresh.eventOrder, references.at(-1).eventOrder);
  assert.equal(fresh.parentEventOrder, original.eventOrder);
  assert.equal(fresh.causalOrder, original.causalOrder);
  assert.equal(
    result.events.some((event) => ['suppressed', 'cancelled'].includes(event.sourceId)),
    false
  );
});

// Cancellation owns pending work, while preparation observes the state live at the surviving application.
test('owned effects prepare once at impact and retain their reserved identity', () => {
  const prepared = [];
  const references = [];
  const catalog = createCanonicalCatalog({ skills: [] });
  const profession = {
    calculations: testProfession.calculations,
    id: 'effect-ownership-fixture',
    buffPolicies: () => [{ kind: 'ownership-fixture' }],
    catalog,
    skillSelectionCatalog: catalog,
    triggerListeners: new Map(),
    projectPlanningState: () => ({}),
    createState: () => ({ value: 1 }),
    initialize(runtime) {
      references.push(runtime.effects.emit({ receipt: true, kind: 'packet', event: packet('cancelled', 1) }));
      references.push(runtime.effects.emit({ receipt: true, kind: 'packet', event: packet('survivor', 1) }));
      runtime.schedule('change', 0.5);
    },
    effectOwner(_runtime, event) {
      return { id: String(event.sourceId), generation: 0 };
    },
    prepareEvent(runtime, event) {
      prepared.push({ sourceId: event.sourceId, at: runtime.time, eventOrder: event.eventOrder });
      return { ...event, stacks: runtime.profession.value };
    },
    tasks: {
      change(runtime) {
        runtime.profession.value = 3;
        runtime.cancelOwner({ id: 'cancelled', generation: 0 });
      }
    }
  };
  const result = runGw2Runtime({ profession, config: {}, rotation: [{ type: 'wait', durationMs: 1100 }] });
  assert.deepEqual(result.warnings, []);
  const survivor = result.events.find((event) => event.sourceId === 'survivor');
  assert.equal(survivor.stacks, 3);
  assert.equal(survivor.eventOrder, references[1].eventOrder);
  assert.ok(Object.isFrozen(references[1]));
  assert.equal(
    result.events.some((event) => event.sourceId === 'cancelled'),
    false
  );
  assert.deepEqual(
    prepared.filter((entry) => ['cancelled', 'survivor'].includes(entry.sourceId)),
    [{ sourceId: 'survivor', at: 1, eventOrder: references[1].eventOrder }]
  );
});

// Two independent modules must not silently assign competing cancellation lifetimes to the same packet.
test('composed ownership rules reject conflicts and accept the same owner', () => {
  const same = () => ({ id: 'shared', generation: 2 });
  assert.deepEqual(composeRuntimeHooks([{ effectOwner: same }, { effectOwner: same }]).effectOwner({}, packet(1, 1)), {
    id: 'shared',
    generation: 2
  });
  const hooks = composeRuntimeHooks([
    { effectOwner: same },
    { effectOwner: () => ({ id: 'different', generation: 2 }) }
  ]);
  assert.throws(() => hooks.effectOwner({}, packet(1, 1)), /Conflicting effect lifetime owners/);
});
