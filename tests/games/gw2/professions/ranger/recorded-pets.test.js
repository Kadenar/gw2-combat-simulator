import assert from 'node:assert/strict';
import test from 'node:test';
import { runRanger } from '#tests/helpers/ranger-simulation.js';
import { rangerProfession } from '#gw2/professions/ranger/profession.js';
import { rangerPetSkillCommandable } from '#gw2/professions/ranger/data/pet-commands.js';
import { swapRangerPets } from '#gw2/professions/ranger/core/skills/actions.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';

const wait = (durationMs) => ({ type: 'wait', durationMs });
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
    assert.equal(rangerPetSkillCommandable(skill, 'Untamed'), true);
    assert.equal(rangerPetSkillCommandable(skill, 'Core'), false);
    const commanded = runRanger([pet.special, wait(12000)], config);
    assert.deepEqual(commanded.warnings, []);
    assert.ok(commanded.resolvedEvents.some((event) => event.skillId === pet.special && event.damage > 0));
  });

  // Pet damage and duration must remain independent of the Ranger's gear while retaining their caster identity.
  test(`${pet.name} owns its strike and condition attributes`, () => {
    const measure = (stats) => {
      const result = runRanger([pet.special, wait(14000)], {
        specialization: 'Untamed',
        selectedPet: pet.name,
        initialUntamedState: 'Ranger',
        stats
      });
      assert.deepEqual(result.warnings, []);
      return result.resolvedEvents.filter(
        (event) => event.skillId === pet.special && ['damage', 'condition'].includes(event.type)
      );
    };

    const baseline = measure({ power: 1000, precision: 1000, ferocity: 0, conditionDamage: 0, expertise: 0 });
    const geared = measure({ power: 4000, precision: 4000, ferocity: 1500, conditionDamage: 3000, expertise: 1500 });
    assert.ok(baseline.some((event) => event.type === 'damage' && event.damage > 0));
    assert.ok(baseline.some((event) => event.type === 'condition' && event.damage > 0));
    assert.ok(baseline.every((event) => event.actorType === 'summon' && event.summonOwner === 'ranger-pet:1:0'));
    const attributes = (events) => events.map((event) => [event.type, event.damage, event.effectiveDuration]);
    assert.deepEqual(attributes(geared), attributes(baseline));
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
    assert.equal(condition.removedAt, swappedAt);
    assert.equal(condition.expiresAt, swappedAt);
    assert.ok(condition.damageTicks.every((tick) => tick.at <= swappedAt));
  }
});
