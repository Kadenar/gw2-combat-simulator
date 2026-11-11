// Minimal merged casts protect frenzy eligibility, repeat claims, and player-owned damage scaling.
import assert from 'node:assert/strict';
import test from 'node:test';

import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { RANGER_PETS } from '#gw2/professions/ranger/data/ranger-pet-data.js';
import { runRanger } from '#tests/helpers/ranger-simulation.js';

const wait = { type: 'wait', durationMs: 4000 };
const apexEvents = (result) =>
  result.resolvedEvents.filter((event) => event.type === 'damage' && event.traitId === TRAIT.APEX_PREDATOR);
const activations = (events) => new Set(events.map((event) => event.activationId));
function run(selectedPet, skills, selectedTraitIds = [TRAIT.APEX_PREDATOR]) {
  const result = runRanger([...skills, wait], {
    specialization: 'Soulbeast',
    selectedPet,
    selectedTraitIds,
    primaryWeapon: 'Shortbow'
  });
  assert.deepEqual(result.warnings, []);
  return result;
}

for (const [pet, skill, count, beast = false] of [
  ['Tiger', ID.BITE, 1],
  ['Tiger', ID.WORLDLY_IMPACT, 1, true],
  ['Lynx', ID.PRIMAL_CRY, 3, true],
  ['Rock Gazelle', ID.KICK, 1],
  ['Rock Gazelle', ID.CHARGE, 1],
  ['Rock Gazelle', ID.WORLDLY_IMPACT, 1, true],
  ['Jungle Spider', ID.ENTANGLING_WEB, 1],
  ['Jungle Spider', ID.POISON_GAS, 1],
  ['Jungle Spider', ID.PRELUDE_LASH, 1, true],
  ['Wallow', ID.MAUL_ID_41406, 1],
  ['Wallow', ID.UNDEAD_PLAGUE, 0],
  ['Wallow', ID.SPIRITUAL_REPRIEVE, 0],
  ...RANGER_PETS.filter((pet) => pet.beastmodeSkillIds.includes(ID.MAUL_ID_44514)).map((pet) => [
    pet.name,
    ID.MAUL_ID_44514,
    2
  ])
]) {
  test(`Apex Predator admits ${count} frenzies for ${pet} skill ${skill}`, () => {
    const result = run(pet, [skill]);
    const events = apexEvents(result);
    assert.equal(activations(events).size, count);

    for (const event of events) {
      assert.equal(event.sourceId, beast ? ID.APEX_PREDATOR_BEAST : ID.APEX_PREDATOR);
      assert.equal(event.actorType, 'effect');
      assert.equal(event.ownerActorType, 'player');
      assert.equal(event.coefficient, 0.3);
      assert.equal(event.weaponStrengthProfileId, 'nonweapon.unequipped');
      assert.ok(event.damage > 0);
    }

    if (events.length) {
      const cause = result.resolvedEvents.find(
        (event) => event.skillId === skill && ['damage', 'condition'].includes(event.type)
      );
      assert.ok(events.every((event) => event.at >= cause.at));
    }
  });
}

test('Apex Predator requires selection and ignores weapon attacks and independent pets', () => {
  assert.deepEqual(apexEvents(run('Tiger', [ID.BITE], [])), []);
  assert.deepEqual(apexEvents(run('Tiger', [ID.CROSSFIRE])), []);
  assert.deepEqual(apexEvents(run('Tiger', [ID.LEAVE_BEASTMODE, { type: 'combat-start' }])), []);
});

test('overlapping merged abilities keep independent frenzies without recursively triggering', () => {
  const events = apexEvents(run('Tiger', [ID.BITE, ID.MAUL_ID_44514]));
  assert.equal(activations(events).size, 3);
  assert.ok(events.every((event) => ['Bite', 'Maul'].includes(event.triggeredBy)));
});

test('admitted frenzies survive leaving Beastmode', () => {
  const result = run('Tiger', [ID.BITE, ID.LEAVE_BEASTMODE]);
  const leave = result.events.find((event) => event.skillId === ID.LEAVE_BEASTMODE && event.type === 'action');
  const events = apexEvents(result);
  assert.equal(activations(events).size, 1);
  assert.ok(events.some((event) => event.at > leave.at));
});
