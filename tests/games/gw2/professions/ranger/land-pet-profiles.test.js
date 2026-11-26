import assert from 'node:assert/strict';
import test from 'node:test';

import { createChargeGrant } from '#gw2/platform/combat/resources/charges.js';
import { rangerPetAutoProfile } from '#gw2/professions/ranger/core/mechanics/pet-profiles.js';
import { swapRangerPets } from '#gw2/professions/ranger/core/skills/actions.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { rangerPetCommandBar, rangerPetSkillCommandable } from '#gw2/professions/ranger/data/pet-commands.js';
import { rangerPetByName } from '#gw2/professions/ranger/data/pets.js';
import { RANGER_PETS } from '#gw2/professions/ranger/data/ranger-pet-data.js';
import { rangerProfession } from '#gw2/professions/ranger/profession.js';
import { wait } from '#tests/helpers/commands.js';
import { runRanger } from '#tests/helpers/ranger-simulation.js';

const petActions = (result) =>
  result.events.filter((event) => event.type === 'action' && event.source === 'ranger-pet');

for (const pet of RANGER_PETS) {
  const { name } = pet;
  const profile = rangerPetAutoProfile(name);

  if (!profile) continue;

  // Every new selection must execute owned natural skills without spending its explicit Beast command.
  test(`${name} loads and autonomously uses only its natural skills`, () => {
    const natural = [profile.basic, ...profile.specials];
    const result = runRanger(['__combat_start', wait(60000)], { selectedPet: name });
    assert.deepEqual(result.warnings, []);
    const actions = petActions(result);
    for (const action of natural) {
      assert.ok(pet.basicSkillId === action.id || pet.specialSkillIds.includes(action.id));
      assert.ok(actions.some((event) => event.skillId === action.id));
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
      assert.equal(rangerPetSkillCommandable(pet, skill, 'Untamed'), true);
      assert.equal(rangerPetSkillCommandable(pet, skill, 'Core'), false);
    }
  });
}

// A basic attack's recharge cannot put it on the command bar or displace Smoke Assault from F3.
test('Untamed leaves Smokescale Bite automatic and routes Smoke Assault to F3', () => {
  const pet = rangerPetByName('Smokescale');
  const bar = rangerPetCommandBar(pet, rangerProfession.catalog.skillsById, 'Untamed');
  assert.ok(!bar.includes(ID.SMOKESCALE_BITE));
  const result = runRanger(['__combat_start', ID.SMOKESCALE_SMOKE_ASSAULT, wait(3000)], {
    selectedPet: pet.name,
    specialization: 'Untamed',
    initialUntamedState: 'Ranger'
  });
  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.inputTrace.actions.find((action) => action.skillId === ID.SMOKESCALE_SMOKE_ASSAULT)?.control,
    'profession-3'
  );
});

// The beast skill keeps F2 when neither neighboring command slot has a special.
test('Untamed routes the Brown Bear command to F2', () => {
  const result = runRanger(['__combat_start', ID.SHAKE_IT_OFF, wait(3000)], {
    selectedPet: 'Brown Bear',
    specialization: 'Untamed',
    initialUntamedState: 'Ranger'
  });
  assert.deepEqual(result.warnings, []);
  assert.equal(result.inputTrace.actions.find((action) => action.skillId === ID.SHAKE_IT_OFF)?.control, 'profession-2');
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
          runtime.profession.core.pet.sharpenSpines = createChargeGrant(1, expiresAt);
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
              charges = runtime.profession.core.pet.sharpenSpines.count;
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
