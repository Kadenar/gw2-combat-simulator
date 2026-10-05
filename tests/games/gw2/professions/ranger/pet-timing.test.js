import assert from 'node:assert/strict';
import test from 'node:test';
import { runRanger } from '#tests/helpers/ranger-simulation.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

const wait = (durationMs) => ({ type: 'wait', durationMs });

// A minimal Maul verifies packet ownership and ordering without depending on a saved rotation.
test('Maul applies two bleeding stacks alongside each of its strikes', () => {
  const result = runRanger([ID.FELINE_MAUL, wait(2000)], {
    specialization: 'Untamed',
    selectedPet: 'Tiger',
    initialUntamedState: 'Ranger'
  });
  assert.deepEqual(result.warnings, []);
  const hits = result.events.filter((event) => event.skillId === ID.FELINE_MAUL && event.type === 'damage');
  const bleeds = result.events.filter(
    (event) => event.skillId === ID.FELINE_MAUL && event.type === 'condition' && event.condition === 'Bleeding'
  );
  assert.ok(hits.length > 0);
  assert.ok(bleeds.length > 0);
  for (const [index, bleed] of bleeds.entries()) {
    assert.equal(bleed.stacks, 2);
    assert.equal(bleed.at, hits[index].at);
    assert.equal(bleed.activationId, hits[index].activationId);
    assert.ok(bleed.eventOrder > hits[index].eventOrder);
  }
});

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
