import assert from 'node:assert/strict';
import test from 'node:test';

import {
  composePlanningState,
  defineProfessionSpecializationState,
  professionCoreState,
  readProfessionCoreState,
  readProfessionSpecializationState
} from '#gw2/platform/profession-definition/state.js';
import { thiefRuntimeSpecializationState, thiefRuntimeState } from '#gw2/professions/thief/core/state-queries.js';
import { snapshotProfessionState } from '#tests/helpers/profession-state.js';

// The shared accessor preserves the owning state identity and rejects a different active specialization.
test('specialization accessors retain factory state and validate the active kind', () => {
  const definition = defineProfessionSpecializationState('Example', (charge) => ({ charge }));
  const state = definition.create(2);
  const profession = { core: {}, specialization: { kind: 'Example', state } };
  assert.equal(definition.from(profession), state);
  assert.equal(professionCoreState(profession), profession.core);

  assert.throws(
    () => definition.from({ ...profession, specialization: { kind: 'Other', state } }),
    /Expected active specialization Example, received Other/
  );
});

// Test snapshots preserve all active runtime fields while detaching them from the live owner.
test('profession snapshots flatten and deeply clone active runtime state', () => {
  const runtime = {
    core: { resource: 10, nested: { value: 1 } },
    specialization: { kind: 'Fixture', state: { eliteResource: 2 } }
  };

  const snapshot = snapshotProfessionState(runtime);
  assert.deepEqual(snapshot, { resource: 10, nested: { value: 1 }, eliteResource: 2 });
  snapshot.nested.value = 9;
  assert.equal(runtime.core.nested.value, 1);
});

test('profession-state reads require nested ownership and cannot cross specialization kinds', () => {
  const core = { resource: 10 };
  const specialization = { charge: 2 };
  const runtime = {
    core,
    specialization: { kind: 'Example', state: specialization }
  };

  assert.equal(readProfessionCoreState(runtime), core);
  assert.deepEqual(readProfessionCoreState(core), {});
  assert.equal(readProfessionSpecializationState(runtime, 'Example'), specialization);
  assert.equal(readProfessionSpecializationState(runtime, 'Other'), undefined);
  assert.equal(readProfessionSpecializationState(specialization, 'Example'), undefined);
  assert.deepEqual(readProfessionCoreState(null), {});
});

// Preview modifiers may lack runtime state; an active sibling must never supply the requested specialization fields.
test('Thief optional queries use explicit ownership and keep specialization kinds separate', () => {
  const core = { leadAttackExpirations: [2] };
  const state = { markedTargetId: 1, markExpiresAt: 5 };
  const profession = { core, specialization: { kind: 'Deadeye', state } };
  assert.equal(thiefRuntimeState(profession), core);
  assert.equal(thiefRuntimeSpecializationState(profession, 'Deadeye'), state);
  assert.deepEqual(thiefRuntimeSpecializationState(profession, 'Antiquary'), {});
  assert.deepEqual(thiefRuntimeSpecializationState(undefined, 'Deadeye'), {});
  assert.deepEqual(thiefRuntimeState(undefined), {});
});

// Duplicate IDs are an assembly error even when both projections happen to publish the same value.
test('planning composition rejects conflicting identities instead of overwriting fields', () => {
  assert.deepEqual(composePlanningState([{ 'test.core.value': 1 }, { 'test.elite.value': 2 }]), {
    'test.core.value': 1,
    'test.elite.value': 2
  });
  assert.throws(
    () => composePlanningState([{ 'test.shared': 1 }, { 'test.shared': 1 }]),
    /Duplicate planning state ID: test.shared/
  );
});
