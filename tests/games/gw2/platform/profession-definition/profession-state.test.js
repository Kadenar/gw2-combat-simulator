import assert from 'node:assert/strict';
import test from 'node:test';

import {
  cloneStateFields,
  composePlanningState,
  defineProfessionSpecializationState,
  readProfessionCoreState,
  readProfessionSpecializationState
} from '#gw2/platform/profession-definition/state.js';
import { snapshotProfessionState } from '#tests/helpers/profession-state.js';

// The shared accessor preserves the owning state identity and rejects a different active specialization.
test('specialization accessors retain factory state and validate the active kind', () => {
  const definition = defineProfessionSpecializationState('Example', (charge) => ({ charge }));
  const state = definition.create(2);
  const profession = { core: {}, specialization: { kind: 'Example', state } };
  for (const context of [{ profession }, { state: { profession } }, { runtime: { profession } }]) {
    assert.equal(definition.from(context), state);
  }

  assert.throws(
    () => definition.from({ profession: { ...profession, specialization: { kind: 'Other', state } } }),
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

// Projection normalization must neither traverse private fields nor retain mutable owner references.
test('selected state fields are detached without copying private bookkeeping', () => {
  const state = {
    active: { stacks: 2 },
    explicit: undefined,
    get private() {
      throw new Error('private read');
    }
  };
  const projected = cloneStateFields(state, ['active', 'explicit']);
  assert.deepEqual(Object.keys(projected), ['active', 'explicit']);
  assert.equal(projected.explicit, undefined);
  state.active.stacks = 3;
  assert.equal(projected.active.stacks, 2);
  projected.active.stacks = 4;
  assert.equal(state.active.stacks, 3);
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
