import assert from 'node:assert/strict';
import test from 'node:test';
import { rangerPetAutoProfile } from '#gw2/professions/ranger/core/mechanics/pet-profiles.js';
import { RANGER_PET_SKILL_IDS } from '../../../../../scripts/data/ranger-pet-skills.mjs';
import { RANGER_PETS } from '#gw2/professions/ranger/data/ranger-pet-data.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { rangerProfession } from '#gw2/professions/ranger/profession.js';
import { rangerPetSkillCommandable } from '#gw2/professions/ranger/data/pet-commands.js';
import { swapRangerPets } from '#gw2/professions/ranger/core/skills/actions.js';
import { grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { runRanger } from '#tests/helpers/ranger-simulation.js';

const wait = (durationMs) => ({ type: 'wait', durationMs });
const petActions = (result) =>
  result.events.filter((event) => event.type === 'action' && event.source === 'ranger-pet');

for (const name of Object.keys(RANGER_PET_SKILL_IDS)) {
  const profile = rangerPetAutoProfile(name);
  // Every new selection must execute owned natural skills without spending its explicit Beast command.
  test(`${name} loads and autonomously uses only its natural skills`, () => {
    const definition = RANGER_PETS.find((pet) => pet.name === name);
    const natural = [profile.basic, ...profile.specials];
    const result = runRanger(['__combat_start', wait(60000)], { selectedPet: name });
    assert.deepEqual(result.warnings, []);
    const actions = petActions(result);
    for (const action of natural) {
      assert.ok(definition.skillIds.includes(action.id));
      assert.ok(actions.some((event) => event.skillId === action.id));
      const skill = rangerProfession.catalog.skillsById.get(action.id);
      assert.equal(skill.petAutonomousSkill, true);
    }

    assert.ok(actions.every((event) => natural.some((skill) => skill.id === event.skillId)));
    const damage = result.resolvedEvents.filter((event) => event.type === 'damage' && event.damage > 0);
    assert.ok(damage.length);
    assert.ok(damage.every((event) => event.actorType === 'summon' && event.summonOwner === 'ranger-pet:1:0'));
  });

  // Untamed owns the special commands; autonomous basics must continue while those commands remain unspent.
  test(`${name} leaves its natural specials under Untamed control`, () => {
    const result = runRanger(['__combat_start', wait(12000)], {
      selectedPet: name,
      specialization: 'Untamed',
      initialUntamedState: 'Ranger'
    });
    assert.deepEqual(result.warnings, []);
    const actions = petActions(result);
    assert.ok(actions.length);
    assert.ok(actions.every((event) => event.skillId === profile.basic.id));
    for (const special of profile.specials) {
      const skill = rangerProfession.catalog.skillsById.get(special.id);
      assert.equal(rangerPetSkillCommandable(skill, 'Untamed'), true);
      assert.equal(rangerPetSkillCommandable(skill, 'Core'), false);
    }
  });
}

// Recharge remains a separate resource: AI recovery cannot make a special ready before its wiki recharge.
test('new autonomous specials respect their unmodified cooldowns', () => {
  for (const name of ['Wolf', 'Bristleback', 'White Tiger', 'Spinegazer']) {
    const profile = rangerPetAutoProfile(name);
    const result = runRanger(['__combat_start', wait(90000)], { selectedPet: name });
    assert.deepEqual(result.warnings, []);
    for (const skill of profile.specials) {
      const uses = petActions(result).filter((event) => event.skillId === skill.id);
      assert.ok(uses.length > 1);
      for (let index = 1; index < uses.length; index++)
        assert.ok(
          uses[index].at - uses[index - 1].at >= rangerProfession.catalog.skillsById.get(skill.id).cooldown - 1e-6
        );
    }
  }
});

// Charge consumption is scoped to the current pet, and retirement must discard its unspent entitlement.
test('Bristleback bleed charges expire, are spent, and cannot migrate through a swap', () => {
  const measure = (expiresAt, swap) => {
    let charges;
    const result = runRanger(
      ['__combat_start', wait(15000)],
      {
        specialization: 'Untamed',
        initialUntamedState: 'Ranger',
        selectedPet: 'Bristleback',
        selectedPet2: 'Wolf'
      },
      {
        initialize(runtime) {
          runtime.profession.core.pet.sharpenSpines = grantCharges(1, expiresAt);
        },
        timeline: swap
          ? [
              {
                at: 0.1,
                run(runtime) {
                  swapRangerPets(runtime.mechanics, runtime.helpers.skillsById.get(ID.PET_SWAP));
                }
              }
            ]
          : [],
        probes: [
          [
            10,
            (runtime) => {
              charges = runtime.profession.core.pet.sharpenSpines.charges;
            }
          ]
        ]
      }
    );
    assert.deepEqual(result.warnings, []);
    const bleeds = result.resolvedEvents.filter((event) => event.skillId === ID.BRISTLEBACK_SHARPEN_SPINES);
    return { charges, bleeds };
  };

  const active = measure(30, false);
  assert.equal(active.charges, 0);
  assert.ok(active.bleeds.length);
  assert.ok(active.bleeds.every((event) => event.summonOwner === 'ranger-pet:1:0'));
  assert.equal(measure(0, false).bleeds.length, 0);
  const swapped = measure(30, true);
  assert.equal(swapped.charges, 0);
  assert.equal(swapped.bleeds.length, 0);
});

// New pet damage must use companion attributes rather than borrowing the Ranger's equipped stats.
test('Spinegazer strike and condition damage remain independent of player gear', () => {
  const measure = (stats) =>
    runRanger(['__combat_start', wait(20000)], { selectedPet: 'Spinegazer', stats })
      .resolvedEvents.filter((event) => ['damage', 'condition'].includes(event.type))
      .map((event) => event.damage);
  const baseline = measure({ power: 1000, precision: 1000, conditionDamage: 0, expertise: 0 });
  assert.ok(baseline.some((damage) => damage > 0));
  assert.deepEqual(measure({ power: 4000, precision: 4000, conditionDamage: 3000, expertise: 1500 }), baseline);
});
