import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { runMesmer } from '#tests/helpers/mesmer-simulation.js';
import assert from 'node:assert/strict';
import test from 'node:test';

// Trait attribution identifies the grant independently of the instrument that triggered it.
test('Troubadour trait boons retain their granting source and status announcement identity', () => {
  const result = runMesmer([ID.LIVELY_LUTE, ID.CRESCENDO], {
    specialization: 'Troubadour',
    selectedTraitIds: [TRAIT.LIFE_OF_THE_PARTY, TRAIT.ALTERED_CHORD]
  });
  assert.deepEqual(result.warnings, []);
  const partyBoons = result.events.filter(
    (event) => event.type === 'buff' && event.sourceId === TRAIT.LIFE_OF_THE_PARTY
  );
  assert.ok(partyBoons.length > 0);
  assert.ok(
    partyBoons.every(
      (event) => event.source === 'Trait' && event.skillName === 'Life of the Party' && event.sourceSkill
    )
  );
  const status = result.events.find((event) => event.type === 'buff' && event.kind === 'altered-chord');
  const announcement = result.events.find((event) => event.type === 'proc' && event.sourceId === TRAIT.ALTERED_CHORD);
  assert.ok(status);
  assert.ok(announcement);
  assert.equal(status.sourceId, TRAIT.ALTERED_CHORD);
  assert.equal(status.parentEventOrder, announcement.eventOrder);
});
