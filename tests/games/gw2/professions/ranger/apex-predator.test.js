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

// Charge's target impact owns both the frenzy and the daze.
test('Gazelle Charge triggers Apex Predator from its impact and publishes a daze', () => {
  const result = run('Rock Gazelle', [ID.CHARGE]);
  const impact = result.resolvedEvents.find((event) => event.name === 'Charge - Impact Damage');
  const frenzy = apexEvents(result);
  assert.ok(impact);
  assert.ok(frenzy.length > 0);
  assert.ok(frenzy.every((event) => event.parentEventOrder === impact.eventOrder && event.at >= impact.at));
  const control = result.events.find((event) => event.type === 'control' && event.skillId === ID.CHARGE);
  assert.equal(control.controlKind, 'daze');
  assert.equal(control.at, impact.at);
});

// Every frenzy hit must see the damage buff granted by its own triggering skill.
for (const [pet, skill] of [
  ['Warthog', ID.BRUTAL_CHARGE_ID_46432],
  ['Rock Gazelle', ID.CHARGE]
]) {
  test(`Apex Predator receives Twice as Vicious from its first hit for ${pet}`, () => {
    const baseline = apexEvents(run(pet, [skill]));
    const result = run(pet, [skill], [TRAIT.APEX_PREDATOR, TRAIT.TWICE_AS_VICIOUS]);
    const buff = result.events.find((event) => event.kind === 'twice-as-vicious');
    const frenzy = apexEvents(result);
    assert.ok(buff);
    assert.ok(frenzy.length > 0);
    assert.equal(frenzy.length, baseline.length);
    frenzy.forEach((event, index) => {
      assert.ok(event.at >= buff.at);
      assert.ok(Math.abs(event.damage - baseline[index].damage * 1.07) < 2);
    });
  });
}

test('overlapping merged abilities keep independent frenzies without recursively triggering', () => {
  const events = apexEvents(run('Tiger', [ID.BITE, ID.MAUL_ID_44514]));
  assert.equal(activations(events).size, 3);
  assert.ok(events.every((event) => ['Bite', 'Maul'].includes(event.triggeredBy)));
});

test('admitted frenzies survive leaving Beastmode', () => {
  // Leave after admission so the test exercises an active frenzy rather than Bite's windup.
  const admittedAt = apexEvents(run('Tiger', [ID.BITE]))[0].at;
  const result = run('Tiger', [
    ID.BITE,
    { type: 'cast', skillId: ID.LEAVE_BEASTMODE, concurrentOffsetMs: Math.ceil((admittedAt * 1000) / 40) * 40 + 40 }
  ]);
  const leave = result.events.find((event) => event.skillId === ID.LEAVE_BEASTMODE && event.type === 'action');
  const events = apexEvents(result);
  assert.equal(activations(events).size, 1);
  assert.ok(events.some((event) => event.at < leave.at));
  assert.ok(events.some((event) => event.at > leave.at));
});

// Every frenzy strike must cause its own siphon, including overlapping Beast frenzies.
for (const [pet, skill] of [
  ['Tiger', ID.BITE],
  ['Lynx', ID.PRIMAL_CRY]
]) {
  test(`Mist Stranger siphons from each Apex Predator strike for ${pet}`, () => {
    const result = runRanger([skill, wait], {
      specialization: 'Soulbeast',
      selectedPet: pet,
      selectedTraitIds: [TRAIT.APEX_PREDATOR],
      primaryWeapon: 'Shortbow',
      relic: 'Mist Stranger'
    });
    assert.deepEqual(result.warnings, []);
    const strikes = apexEvents(result);
    assert.ok(strikes.length > 1);
    for (const strike of strikes) {
      const siphons = result.resolvedEvents.filter(
        (event) => event.skillName === 'Relic of the Mist Stranger' && event.parentEventOrder === strike.eventOrder
      );
      assert.equal(siphons.length, 1);
      assert.equal(siphons[0].damage, 105 * strike.hits);
      assert.equal(siphons[0].at, strike.at);
    }
  });
}
