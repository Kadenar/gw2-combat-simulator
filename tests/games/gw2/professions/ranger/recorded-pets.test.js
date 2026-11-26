import assert from 'node:assert/strict';
import test from 'node:test';

import { gw2Time } from '#gw2/platform/combat/clock.js';
import { swapRangerPets } from '#gw2/professions/ranger/core/skills/actions.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { rangerPetSkillCommandable } from '#gw2/professions/ranger/data/pet-commands.js';
import { rangerPetByName } from '#gw2/professions/ranger/data/pets.js';
import { rangerProfession } from '#gw2/professions/ranger/profession.js';
import { wait } from '#tests/helpers/commands.js';
import { runRanger } from '#tests/helpers/ranger-simulation.js';

const pets = [
  { name: 'Boar', basic: ID.PORCINE_JAB, special: ID.PORCINE_MAUL },
  { name: 'Aether Hunter', basic: ID.AETHER_HUNTER_BITE, special: ID.AETHER_HUNTER_LEY_LINE_VORTEX },
  { name: 'Raptor Swiftwing', basic: ID.RAPTOR_SWIFTWING_CLAW, special: ID.RAPTOR_SWIFTWING_SAURIAN_MIGHT }
];

for (const pet of pets) {
  // Untamed retains automatic basics while its natural specials require an explicit pet command.
  test(`${pet.name} starts its basic attack without spending a command-controlled special`, () => {
    const config = { specialization: 'Untamed', selectedPet: pet.name, initialUntamedState: 'Ranger' };
    const result = runRanger(['__combat_start', wait(12000)], config);
    assert.deepEqual(result.warnings, []);
    const damage = result.resolvedEvents.filter((event) => event.type === 'damage');
    assert.ok(damage.length > 0);
    assert.ok(damage.every((event) => event.skillId === pet.basic && event.actorType === 'summon'));
    const skill = rangerProfession.catalog.skillsById.get(pet.special);
    const definition = rangerPetByName(pet.name);
    assert.equal(rangerPetSkillCommandable(definition, skill, 'Untamed'), true);
    assert.equal(rangerPetSkillCommandable(definition, skill, 'Core'), false);
    const commanded = runRanger([pet.special, wait(12000)], config);
    assert.deepEqual(commanded.warnings, []);
    assert.ok(commanded.resolvedEvents.some((event) => event.skillId === pet.special && event.damage > 0));
  });
}

for (const [pet, skillId] of [
  ['Boar', ID.PORCINE_BRUTAL_CHARGE],
  ['Aether Hunter', ID.DIMENSION_BREACH],
  ['Raptor Swiftwing', ID.PIERCING_SHRIEK]
]) {
  // The landed pet control must reach trait reactions with the same cause as its strike.
  test(`${pet}'s control triggers Debilitating Blows after its impact`, () => {
    const result = runRanger([skillId, wait(6000)], {
      specialization: 'Untamed',
      selectedPet: pet,
      initialUntamedState: 'Ranger',
      selectedTraitIds: [TRAIT.DEBILITATING_BLOWS]
    });
    assert.deepEqual(result.warnings, []);
    const strike = result.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === skillId);
    const controls = result.events.filter((event) => event.type === 'control' && event.skillId === skillId);
    const poison = result.resolvedEvents.find(
      (event) => event.skillId === TRAIT.DEBILITATING_BLOWS && event.condition === 'Poisoned'
    );
    assert.ok(strike && controls.length && poison);
    assert.equal(poison.at, strike.at);
    assert.equal(poison.parentEventOrder, controls[0].eventOrder);
    assert.ok(poison.eventOrder > strike.eventOrder);
    assert.equal(poison.ownerActorType, 'player');
  });
}

// A channeled natural skill cannot keep applying conditions or paying pet-owned damage after replacement.
test('swapping Aether Hunter cancels its vortex and retires its applied conditions', () => {
  const swappedAt = 1.5;
  const result = runRanger(
    [ID.AETHER_HUNTER_LEY_LINE_VORTEX, wait(10000)],
    {
      specialization: 'Untamed',
      selectedPet: 'Aether Hunter',
      selectedPet2: 'Pig',
      initialUntamedState: 'Ranger'
    },
    {
      timeline: [
        {
          at: swappedAt,
          run(runtime) {
            swapRangerPets(runtime.mechanics, runtime.helpers.skillsById.get(ID.PET_SWAP));
          }
        }
      ]
    }
  );
  assert.deepEqual(result.warnings, []);
  const vortex = result.resolvedEvents.filter((event) => event.skillId === ID.AETHER_HUNTER_LEY_LINE_VORTEX);
  assert.ok(vortex.some((event) => event.damage > 0));
  assert.ok(vortex.every((event) => event.at < swappedAt));
  for (const condition of vortex.filter((event) => event.type === 'condition')) {
    assert.equal(condition.removedAt, gw2Time(swappedAt));
    assert.equal(condition.expiresAt, gw2Time(swappedAt));
    assert.ok(condition.damageTicks.every((tick) => tick.at <= gw2Time(swappedAt)));
  }
});
