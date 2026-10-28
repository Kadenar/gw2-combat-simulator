import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { runRanger } from '#tests/helpers/ranger-simulation.js';

// Entangle's delayed damage must not preserve the dagger step that preceded its cast.
test('Entangle resets the dagger chain before the next weapon attack', () => {
  const result = runRanger([ID.GROUNDWORK_GOUGE, ID.ENTANGLE, ID.GROUNDWORK_GOUGE, ID.LEADING_SWIPE], {
    primaryWeapon: 'Dagger'
  });
  assert.deepEqual(result.warnings, []);
  assert.equal(result.planningState.profession[STATE.AUTOATTACK_CHAINS][ID.GROUNDWORK_GOUGE], ID.SERPENT_STAB);
});
