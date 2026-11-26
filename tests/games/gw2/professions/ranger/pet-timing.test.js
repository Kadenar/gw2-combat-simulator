import assert from 'node:assert/strict';
import test from 'node:test';

import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { rangerProfession } from '#gw2/professions/ranger/profession.js';
import { wait } from '#tests/helpers/commands.js';
import { runRanger } from '#tests/helpers/ranger-simulation.js';

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

const patchId = 'long-pet-actions';
const patchedDurationMs = 3600;
const profession = withPatchPreview(rangerProfession, {
  id: patchId,
  label: 'Long pet actions',
  professions: {
    ranger: {
      skills: {
        [ID.FELINE_MAUL]: { fields: { castTimeMs: patchedDurationMs } },
        [ID.BIRD_SWOOP]: { fields: { castTimeMs: patchedDurationMs } },
        [ID.CANINE_CRIPPLING_LEAP]: { fields: { castTimeMs: patchedDurationMs } }
      }
    }
  }
});

// A recovery measurement or a Quickness-only animation must leave normal command ownership with the selected skill.
for (const [pet, first, next] of [
  ['Lynx', ID.FELINE_MAUL, ID.FELINE_BITE],
  ['Raven', ID.BIRD_SWOOP, ID.QUICKENING_SCREECH_PET]
]) {
  test(`${pet} waits for the patched command before starting its queued command`, () => {
    const result = runRanger(
      ['__combat_start', first, next, wait(8000)],
      {
        patchId,
        selectedPet: pet,
        specialization: 'Untamed',
        initialUntamedState: 'Ranger'
      },
      { profession }
    );
    assert.deepEqual(result.warnings, []);
    const actions = result.events.filter((event) => event.type === 'action' && event.source === 'ranger-pet');
    const command = actions.find((action) => action.skillId === first);
    const queued = actions.find((action) => action.skillId === next);
    assert.ok(command && queued);
    assert.ok(queued.at >= command.at + patchedDurationMs / 1000);
  });
}

// A measured normal animation still releases the queue on its own schedule when the catalog duration changes.
test('Wolf keeps its measured command recovery under a longer catalog patch', () => {
  function nextCommandStart(selectedPatch) {
    const result = runRanger(
      ['__combat_start', ID.CANINE_CRIPPLING_LEAP, ID.CANINE_BRUTAL_CHARGE, wait(8000)],
      { patchId: selectedPatch, selectedPet: 'Wolf', specialization: 'Untamed', initialUntamedState: 'Ranger' },
      { profession }
    );
    assert.deepEqual(result.warnings, []);
    return result.events.find((event) => event.type === 'action' && event.skillId === ID.CANINE_BRUTAL_CHARGE).at;
  }

  assert.equal(nextCommandStart(patchId), nextCommandStart('current'));
});

// The autonomous scheduler must reserve the pet until the current action ends even when recovery expires first.
test('autonomous pet actions wait for a patched action to finish', () => {
  const result = runRanger(['__combat_start', wait(10000)], { patchId, selectedPet: 'Tiger' }, { profession });
  assert.deepEqual(result.warnings, []);
  const actions = result.events.filter((event) => event.type === 'action' && event.source === 'ranger-pet');
  const maul = actions.findIndex((action) => action.skillId === ID.FELINE_MAUL);
  assert.ok(maul >= 0 && actions[maul + 1]);
  assert.ok(actions[maul + 1].at >= actions[maul].endsAt);
});
