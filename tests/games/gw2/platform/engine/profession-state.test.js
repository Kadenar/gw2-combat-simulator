import assert from 'node:assert/strict';
import test from 'node:test';
import {
  composePublicStateProjections,
  definePublicStateDefaults,
  restoreFlatProfessionState,
  snapshotProfessionState,
  readProfessionCoreState,
  readProfessionSpecializationState,
  projectPublicProfessionState
} from '#gw2/platform/engine/profession/state.js';
import { createScheduler } from '#gw2/platform/execution/scheduler.js';
import { testProfession } from '#tests/fixtures/profession.js';

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
  const state = createScheduler({ profession: testProfession }).state;

  assert.deepEqual(
    Object.keys(state).sort(),
    ['activeWeaponSet', 'ammo', 'cooldowns', 'lockouts', 'profession', 'rechargeProgress', 'skillUses', 'time'].sort()
  );
  assert.deepEqual(state.profession, { charge: 0, controlEvents: 0 });
  assert.equal(Object.hasOwn(state, 'clones'), false);
  assert.equal(Object.hasOwn(state, 'numericResource'), false);
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

test('public descriptors preserve field order, fallback precedence, and detached projected values', () => {
  // Explicit fields need no fallback; overlapping slices retain their original key and merge order.
  const fallback = definePublicStateDefaults({
    active: { stacks: 0 },
    explicit: 'fallback',
    inactive: [{ stacks: 1 }]
  });
  const projection = composePublicStateProjections([
    { keys: ['core'], defaults: {} },
    fallback,
    definePublicStateDefaults({ explicit: 'later fallback' })
  ]);
  assert.deepEqual(projection.keys, ['core', 'active', 'explicit', 'inactive', 'explicit']);
  assert.equal(projection.defaults.explicit, 'later fallback');
  const absent = projectPublicProfessionState({}, projection.keys, projection.defaults);
  assert.equal(absent.explicit, 'later fallback');
  assert.equal(Object.hasOwn(absent, 'core'), true);
  assert.equal(absent.core, undefined);

  const state = { active: { stacks: 2 }, explicit: undefined, private: true };
  const projected = projectPublicProfessionState(state, projection.keys, projection.defaults);
  assert.deepEqual(Object.keys(projected), ['core', 'active', 'explicit', 'inactive']);
  assert.deepEqual(projected, {
    core: undefined,
    active: { stacks: 2 },
    explicit: undefined,
    inactive: [{ stacks: 1 }]
  });
  state.active.stacks = 3;
  assert.equal(projected.active.stacks, 2);
  projected.inactive[0].stacks = 9;
  assert.equal(fallback.defaults.inactive[0].stacks, 1);
  assert.equal(absent.inactive[0].stacks, 1);
});
