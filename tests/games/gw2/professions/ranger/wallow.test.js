import assert from 'node:assert/strict';
import test from 'node:test';
import { runRanger } from '#tests/helpers/ranger-simulation.js';
import { rangerCatalog } from '#gw2/professions/ranger/catalog.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { RANGER_PETS } from '#gw2/professions/ranger/data/ranger-pet-data.js';
import { rangerPetBaseAttributes } from '#gw2/professions/ranger/core/mechanics/pet-profiles.js';

const wait = (durationMs) => ({ type: 'wait', durationMs });

// Wallow retains Porcine traits while exposing its own unmerged attacks and merged bar.
test('Wallow loads its attributes, autonomous attacks, command, and merged skills', () => {
  const pet = RANGER_PETS.find((entry) => entry.name === 'Wallow');
  assert.equal(pet.family, 'porcine');
  assert.equal(pet.archetype, 'Supportive');
  assert.deepEqual(pet.beastmodeSkillIds, [ID.MAUL_ID_41406, ID.UNDEAD_PLAGUE, ID.SPIRITUAL_REPRIEVE]);
  assert.deepEqual(rangerPetBaseAttributes('Wallow'), {
    power: 1524,
    precision: 1524,
    toughness: 2211,
    vitality: 2898,
    conditionDamage: 700,
    ferocity: 0,
    expertise: 0,
    healingPower: 0
  });
  for (const skillId of [...pet.skillIds, ...pet.beastmodeSkillIds]) assert.ok(rangerCatalog.skillsById.has(skillId));

  const result = runRanger(['__combat_start', wait(30000)], { selectedPet: 'Wallow' });
  assert.deepEqual(result.warnings, []);
  const actions = result.events.filter((event) => event.type === 'action' && event.source === 'ranger-pet');
  for (const skillId of [ID.VAMPIRIC_BITE, ID.WALLOW_MAUL, ID.UNDEAD_PLAGUE_PET])
    assert.ok(actions.some((event) => event.skillId === skillId));
  assert.ok(actions.every((event) => event.skillId !== ID.BLOODTHIRSTY_CHARGE));
  const bite = result.events.find((event) => event.type === 'damage' && event.skillId === ID.VAMPIRIC_BITE);
  assert.equal(bite.coefficient, 0.42);
  assert.equal(bite.summonBaseConditionDamage, 700);
  for (const [skillId, cooldown] of [
    [ID.WALLOW_MAUL, 12],
    [ID.UNDEAD_PLAGUE_PET, 20]
  ]) {
    const casts = actions.filter((event) => event.skillId === skillId);
    assert.ok(casts.length >= 2);
    for (let index = 1; index < casts.length; index++) assert.ok(casts[index].at - casts[index - 1].at >= cooldown);
  }

  const merged = runRanger([...pet.beastmodeSkillIds, wait(6000)], {
    specialization: 'Soulbeast',
    selectedPet: 'Wallow'
  });
  assert.deepEqual(merged.warnings, []);
  assert.ok(merged.events.some((event) => event.type === 'buff' && event.kind === 'resistance'));
});

// Minimal casts verify the per-hit formulas without imposing a saved-rotation regression.
test('Wallow and merged Porcine Maul apply the correct bleeding with each hit', () => {
  for (const [specialization, skillId, coefficient, stacks] of [
    ['Untamed', ID.WALLOW_MAUL, 0.33, 2],
    ['Soulbeast', ID.MAUL_ID_41406, 1.1, 1]
  ]) {
    const result = runRanger([skillId, wait(2000)], {
      specialization,
      selectedPet: 'Wallow',
      initialUntamedState: 'Ranger'
    });
    assert.deepEqual(result.warnings, []);
    const hits = result.events.filter((event) => event.type === 'damage' && event.skillId === skillId);
    const bleeds = result.events.filter((event) => event.type === 'condition' && event.skillId === skillId);
    assert.equal(hits.length, 2);
    assert.equal(bleeds.length, 2);
    for (const [index, hit] of hits.entries()) {
      assert.equal(hit.coefficient, coefficient);
      assert.equal(bleeds[index].condition, 'Bleeding');
      assert.equal(bleeds[index].stacks, stacks);
      assert.equal(bleeds[index].duration, 6);
      assert.equal(bleeds[index].at, hit.at);
      assert.ok(bleeds[index].eventOrder > hit.eventOrder);
    }
  }
});

// Cloud pulses outlive the cast, but retain their original pet or player ownership and one-second spacing.
test('both Undead Plague variants emit five poison pulses and a five-second field', () => {
  for (const [specialization, skillId, actorType] of [
    ['Untamed', ID.UNDEAD_PLAGUE_PET, 'summon'],
    ['Soulbeast', ID.UNDEAD_PLAGUE, 'player']
  ]) {
    const result = runRanger([skillId, wait(6000)], {
      specialization,
      selectedPet: 'Wallow',
      initialUntamedState: 'Ranger'
    });
    assert.deepEqual(result.warnings, []);
    const hits = result.events.filter((event) => event.type === 'damage' && event.skillId === skillId);
    const poisons = result.events.filter((event) => event.type === 'condition' && event.skillId === skillId);
    assert.equal(hits.length, 5);
    assert.equal(poisons.length, 5);
    for (const [index, hit] of hits.entries()) {
      assert.equal(hit.coefficient, 0.2);
      assert.equal(hit.actorType, actorType);
      assert.ok(Math.abs(hit.at - hits[0].at - index) < 1e-9);
      assert.equal(poisons[index].at, hit.at);
      assert.equal(poisons[index].condition, 'Poisoned');
      assert.equal(poisons[index].duration, 4);
      assert.equal(poisons[index].stacks, 1);
      assert.equal(poisons[index].actorType, actorType);
    }

    const fields = result.events.filter((event) => event.type === 'combo_field' && event.skillId === skillId);
    assert.equal(fields.length, 1);
    assert.equal(fields[0].fieldType, 'Poison');
    assert.equal(fields[0].at, hits[0].at);
    assert.equal(fields[0].expiresAt - fields[0].at, 5);
    assert.equal(rangerCatalog.skillsById.get(skillId).cooldown, 20);
  }
});

// A commanded charge must apply control at impact and finish recovery before automatic attacks resume.
test('Bloodthirsty Charge applies knockback and bleeding on the pet lane', () => {
  const result = runRanger(['__combat_start', ID.BLOODTHIRSTY_CHARGE, wait(8000)], { selectedPet: 'Wallow' });
  assert.deepEqual(result.warnings, []);
  const hit = result.events.find((event) => event.type === 'damage' && event.skillId === ID.BLOODTHIRSTY_CHARGE);
  const bleed = result.events.find((event) => event.type === 'condition' && event.skillId === ID.BLOODTHIRSTY_CHARGE);
  const control = result.events.find((event) => event.type === 'control' && event.skillId === ID.BLOODTHIRSTY_CHARGE);
  assert.equal(hit.coefficient, 1);
  assert.equal(bleed.stacks, 2);
  assert.equal(bleed.duration, 8);
  assert.equal(bleed.at, hit.at);
  assert.equal(control.at, hit.at);
  assert.equal(control.controlKind, 'knockback');
  assert.equal(control.summonOwner, hit.summonOwner);
  const actions = result.events.filter((event) => event.type === 'action' && event.source === 'ranger-pet');
  for (let index = 1; index < actions.length; index++) assert.ok(actions[index].at >= actions[index - 1].endsAt);
});
