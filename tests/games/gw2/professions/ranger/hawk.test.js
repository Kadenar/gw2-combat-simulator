import { baseAttributeInputs } from '#gw2/platform/builds/attribute-inputs.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { runRanger } from '#tests/helpers/ranger-simulation.js';
import { rangerCatalog } from '#gw2/professions/ranger/catalog.js';
import { rangerPetBaseAttributes } from '#gw2/professions/ranger/core/mechanics/pet-profiles.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';

const wait = (durationMs) => ({ type: 'wait', durationMs });
const hawk = { selectedPet: 'Hawk', specialization: 'Untamed', initialUntamedState: 'Ranger' };

// AI spends its own cooldowns while F2 remains an explicit command.
test('Hawk loads its attributes and runs its three autonomous skills', () => {
  assert.deepEqual(rangerPetBaseAttributes('Hawk'), {
    power: 1524,
    precision: 2211,
    toughness: 1524,
    vitality: 2211,
    conditionDamage: 700,
    ferocity: 0,
    healingPower: 0,
    expertise: 0
  });
  const result = runRanger(['__combat_start', wait(35000)], { selectedPet: 'Hawk' });
  assert.deepEqual(result.warnings, []);
  const actions = result.events.filter((event) => event.type === 'action' && event.source === 'ranger-pet');
  assert.ok(actions.some((event) => event.skillId === ID.BIRD_SLASH));
  assert.ok(actions.every((event) => event.skillId !== ID.LACERATING_SLASH));
  for (const [skillId, cooldown] of [
    [ID.BIRD_SWOOP, 8],
    [ID.QUICKENING_SCREECH_PET, 20]
  ]) {
    const casts = actions.filter((event) => event.skillId === skillId);
    assert.ok(casts.length >= 2);
    for (let index = 1; index < casts.length; index++) assert.ok(casts[index].at - casts[index - 1].at >= cooldown);
  }

  const first = result.events.find((event) => event.type === 'damage' && event.skillId === ID.BIRD_SLASH);
  const hits = result.events.filter((event) => event.type === 'damage' && event.activationId === first.activationId);
  assert.ok(hits.length > 0);
  assert.ok(hits.every((event) => event.coefficient === 0.38));
  for (let index = 1; index < actions.length; index++) assert.ok(actions[index].at >= actions[index - 1].endsAt);
  assert.equal(first.summonBaseConditionDamage, 700);
});

// Untamed keeps its automatic lane on Slash and reserves the measured recovery after each explicit command.
test('Untamed Hawk reserves special skills for commands without overlapping its AI attacks', () => {
  const idle = runRanger(['__combat_start', wait(12000)], hawk);
  assert.deepEqual(idle.warnings, []);
  assert.ok(
    idle.events
      .filter((event) => event.type === 'action' && event.source === 'ranger-pet')
      .every((event) => event.skillId === ID.BIRD_SLASH)
  );
  const commanded = runRanger(
    ['__combat_start', wait(1000), ID.BIRD_SWOOP, ID.QUICKENING_SCREECH_PET, ID.LACERATING_SLASH, wait(12000)],
    hawk
  );
  assert.deepEqual(commanded.warnings, []);
  const actions = commanded.events.filter((event) => event.type === 'action' && event.source === 'ranger-pet');
  for (const skillId of [ID.BIRD_SWOOP, ID.QUICKENING_SCREECH_PET, ID.LACERATING_SLASH])
    assert.ok(actions.some((event) => event.skillId === skillId));
  for (let index = 1; index < actions.length; index++) assert.ok(actions[index].at >= actions[index - 1].endsAt);
});

// The Beast command delivers exactly three bleeding stacks with each of its two impacts.
test('Lacerating Slash applies six bleeding stacks across two hits', () => {
  const result = runRanger([ID.LACERATING_SLASH, wait(1000)], hawk);
  assert.deepEqual(result.warnings, []);
  const hits = result.events.filter((event) => event.type === 'damage' && event.skillId === ID.LACERATING_SLASH);
  const bleeds = result.events.filter((event) => event.type === 'condition' && event.skillId === ID.LACERATING_SLASH);
  assert.ok(hits.length > 0);
  assert.ok(bleeds.length > 0);
  for (const [index, hit] of hits.entries()) {
    assert.equal(hit.coefficient, 1);
    assert.equal(bleeds[index].at, hit.at);
    assert.equal(bleeds[index].stacks, 3);
    assert.equal(bleeds[index].duration, 15);
  }

  assert.equal(rangerCatalog.skillsById.get(ID.LACERATING_SLASH).cooldown, 20);
});

// Pet boon duration uses its own selected traits independently of player equipment.
test('pet Screech scales only with Lingering Magic while merged Screech uses player boon duration', () => {
  const concentrationBonus = rangerCatalog.balanceProfilesById.get(TRAIT.LINGERING_MAGIC).attributeBonus;
  for (const trait of [false, true]) {
    {
      const result = runRanger([ID.QUICKENING_SCREECH_PET, wait(1000)], {
        ...hawk,
        attributeInputs: baseAttributeInputs({
          concentration: 1500,
          boonDurationBonus: 50,
          boonDurationBonuses: { Swiftness: 50 }
        }),
        selectedTraitIds: trait ? [TRAIT.LINGERING_MAGIC] : [],
        allies: { count: 4 }
      });
      assert.deepEqual(result.warnings, []);
      const boon = result.resolvedEvents.find(
        (event) => event.type === 'buff' && event.skillId === ID.QUICKENING_SCREECH_PET
      );
      assert.equal(boon.duration, 10 * (1 + (trait ? concentrationBonus : 0) / 1500));
      assert.equal(boon.resolvedAudience.includesSelf, true);
      // The casting pet and ranger occupy two of the five recipient slots.
      assert.equal(boon.resolvedAudience.alliedPlayerCount, 3);
      assert.equal(boon.resolvedAudience.recipientCount, 5);
      assert.equal(boon.actorType, 'summon');
    }
  }

  const merged = runRanger([ID.QUICKENING_SCREECH], {
    selectedPet: 'Hawk',
    specialization: 'Soulbeast',
    attributeInputs: baseAttributeInputs({ concentration: 750 })
  });
  assert.deepEqual(merged.warnings, []);
  const boon = merged.resolvedEvents.find((event) => event.type === 'buff' && event.skillId === ID.QUICKENING_SCREECH);
  assert.equal(boon.duration, 15);
  assert.equal(boon.actorType, 'player');
  assert.equal(rangerCatalog.skillsById.get(ID.QUICKENING_SCREECH).cooldown, 15);
});

// Both variants finish an existing field at impact, preserving their distinct damage and Vulnerability payloads.
test('pet and merged Swoop perform leap combos with their respective payloads', () => {
  for (const [specialization, skillId, coefficient, stacks, cooldown] of [
    ['Untamed', ID.BIRD_SWOOP, 0.66, 1, 8],
    ['Soulbeast', ID.SWOOP_ID_44991, 1.2, 5, 10]
  ]) {
    const result = runRanger([ID.FROST_TRAP, wait(600), skillId, wait(1500)], { ...hawk, specialization });
    assert.deepEqual(result.warnings, []);
    const hit = result.events.find((event) => event.type === 'damage' && event.skillId === skillId);
    const vulnerability = result.events.find((event) => event.type === 'condition' && event.skillId === skillId);
    assert.equal(hit.coefficient, coefficient);
    assert.equal(vulnerability.stacks, stacks);
    assert.equal(vulnerability.duration, 6);
    assert.equal(vulnerability.at, hit.at);
    assert.ok(
      result.resolvedEvents.some(
        (event) => event.type === 'combo' && event.finisherType === 'Leap' && event.fieldType === 'Ice'
      )
    );
    assert.equal(rangerCatalog.skillsById.get(skillId).cooldown, cooldown);
  }
});

// Cancelling the channel preserves only landed pulses and their matching condition packets.
test('Primal Cry applies one set of conditions per surviving pulse', () => {
  for (const [interruptAfterMs, pulseCount] of [
    [undefined, 3],
    [300, 1]
  ]) {
    const result = runRanger([{ type: 'cast', skillId: ID.PRIMAL_CRY, interruptAfterMs }, wait(1500)], {
      selectedPet: 'Hawk',
      specialization: 'Soulbeast'
    });
    assert.deepEqual(result.warnings, []);
    const hits = result.events.filter((event) => event.type === 'damage' && event.skillId === ID.PRIMAL_CRY);
    assert.equal(hits.length, pulseCount);
    for (const [condition, stacks] of [
      ['Poisoned', 1],
      ['Bleeding', 1],
      ['Vulnerability', 3]
    ]) {
      const applications = result.events.filter(
        (event) => event.type === 'condition' && event.skillId === ID.PRIMAL_CRY && event.condition === condition
      );
      assert.equal(applications.length, pulseCount);
      for (const [index, hit] of hits.entries()) {
        assert.equal(hit.coefficient, 0.4);
        assert.equal(applications[index].at, hit.at);
        assert.equal(applications[index].stacks, stacks);
        assert.equal(applications[index].duration, 6);
        assert.ok(applications[index].eventOrder > hit.eventOrder);
      }
    }
  }

  assert.equal(rangerCatalog.skillsById.get(ID.PRIMAL_CRY).cooldown, 20);
});
