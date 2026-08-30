import assert from 'node:assert/strict';
import test from 'node:test';

import {
  projectPublicProfessionState,
  readProfessionCoreState,
  readProfessionSpecializationState
} from '#gw2/platform/engine/profession/state.js';

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
