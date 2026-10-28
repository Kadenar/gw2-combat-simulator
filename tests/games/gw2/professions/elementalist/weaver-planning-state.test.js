import assert from 'node:assert/strict';
import test from 'node:test';

import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { weaverState } from '#gw2/professions/elementalist/specializations/weaver/state.js';
import { ELEMENTALIST_STATE_IDS as STATE } from '#gw2/professions/elementalist/state-ids.js';
import { projectObservedState } from '#tests/helpers/observed-runtime.js';

// Conflicting names outside the owning slice must not affect the public observation.
test('Weaver projects stable IDs from its own state and omits runtime property names', () => {
  const state = weaverState.create({ secondaryAttunement: 'Air' });
  Object.assign(state, {
    unravelUntil: 5,
    weaveSelfUntil: 20,
    weaveSelfVisited: ['Fire', 'Air'],
    perfectWeaveUntil: 0,
    ferventStanceUntil: 8
  });
  const profession = {
    core: { secondaryAttunement: 'Earth', unravelUntil: 99 },
    specialization: { kind: 'Weaver', state }
  };
  const projected = projectObservedState(elementalistProfession, { profession });
  assert.equal(projected[STATE.SECONDARY_ATTUNEMENT], 'Air');
  assert.equal(projected[STATE.UNRAVEL_UNTIL], 5);
  assert.equal(projected[STATE.WEAVE_SELF_UNTIL], 20);
  assert.deepEqual(projected[STATE.WEAVE_SELF_VISITED], ['Fire', 'Air']);
  assert.equal(projected[STATE.PERFECT_WEAVE_UNTIL], 0);
  assert.equal(projected[STATE.FERVENT_STANCE_UNTIL], 8);
  for (const key of Object.keys(state)) assert.equal(Object.hasOwn(projected, key), false, key);
});
