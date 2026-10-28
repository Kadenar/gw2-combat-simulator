import assert from 'node:assert/strict';
import test from 'node:test';

import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { runRanger } from '#tests/helpers/ranger-simulation.js';

const wait = (durationMs) => ({ type: 'wait', durationMs });

// Delayed commands must finish their own animation before the autonomous lane resumes.
test('queued pet commands retain exclusive ownership of the pet lane', () => {
  const result = runRanger(['__combat_start', wait(101), ID.FURIOUS_POUNCE, ID.FELINE_MAUL, wait(7000)], {
    specialization: 'Untamed',
    selectedPet: 'Tiger',
    initialUntamedState: 'Ranger'
  });
  assert.deepEqual(result.warnings, []);
  const actions = result.events.filter((event) => event.type === 'action' && event.source === 'ranger-pet');
  assert.ok(actions.some((event) => event.skillId === ID.FURIOUS_POUNCE));
  assert.ok(actions.some((event) => event.skillId === ID.FELINE_MAUL));
  for (let index = 1; index < actions.length; index++) assert.ok(actions[index].at + 1e-9 >= actions[index - 1].endsAt);
});
