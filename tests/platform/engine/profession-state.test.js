import assert from 'node:assert/strict';
import test from 'node:test';
import {
  restoreFlatProfessionState,
  snapshotProfessionState,
  readProfessionCoreState,
  readProfessionSpecializationState,
  projectPublicProfessionState
} from '#gw2/platform/engine/profession/state.js';
import { createSchedulerState } from '#gw2/platform/engine/execution/state.js';
import { testProfession } from '../../fixtures/test-profession.js';

// Shared profession state preserves isolated runtime fields and detached public snapshots.
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

test('flat snapshot restoration routes declared specialization keys and clones values', () => {
  const core = { resource: 1 };
  const specialization = { eliteResource: 2, nested: {} };
  const incoming = { resource: 3, eliteResource: 4, nested: { value: 5 } };

  restoreFlatProfessionState(core, specialization, incoming);
  assert.deepEqual(core, { resource: 3 });
  assert.deepEqual(specialization, { eliteResource: 4, nested: { value: 5 } });
  incoming.nested.value = 8;
  assert.equal(specialization.nested.value, 5);
});

test('generic scheduler state contains no profession-specific fields', () => {
  const state = createSchedulerState({ profession: testProfession });

  assert.deepEqual(
    Object.keys(state).sort(),
    ['activeWeaponSet', 'ammo', 'cooldowns', 'lockouts', 'pendingEvents', 'profession', 'skillUses', 'time'].sort()
  );
  assert.deepEqual(state.profession, { charge: 0, controlEvents: 0 });
  assert.equal(Object.hasOwn(state, 'clones'), false);
  assert.equal(Object.hasOwn(state, 'numericResource'), false);
});

test('compatible profession-state reads accept nested and flat state without crossing specialization kinds', () => {
  const core = { resource: 10 };
  const specialization = { charge: 2 };
  const runtime = {
    core,
    specialization: { kind: 'Example', state: specialization }
  };

  assert.equal(readProfessionCoreState(runtime), core);
  assert.equal(readProfessionCoreState(core), core);
  assert.equal(readProfessionSpecializationState(runtime, 'Example'), specialization);
  assert.equal(readProfessionSpecializationState(runtime, 'Other'), undefined);
  assert.equal(readProfessionSpecializationState(specialization, 'Example'), specialization);
  assert.deepEqual(readProfessionCoreState(null), {});
});

test('public profession-state projection selects, defaults, and detaches declared fields', () => {
  const state = { active: { stacks: 2 }, explicit: undefined, private: true };
  const projected = projectPublicProfessionState(state, ['active', 'explicit', 'inactive'], {
    explicit: 'fallback',
    inactive: []
  });

  assert.deepEqual(projected, { active: { stacks: 2 }, explicit: undefined, inactive: [] });
  state.active.stacks = 3;
  assert.equal(projected.active.stacks, 2);
});
