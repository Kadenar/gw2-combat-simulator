import assert from 'node:assert/strict';
import test from 'node:test';

import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { rangerCatalog } from '#gw2/professions/ranger/catalog.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { wait } from '#tests/helpers/commands.js';
import { runRanger } from '#tests/helpers/ranger-simulation.js';

const hawk = { selectedPet: 'Hawk', specialization: 'Untamed', initialUntamedState: 'Ranger' };

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

// Pet boon duration uses its own selected traits independently of player equipment.
test('pet Screech scales only with Lingering Magic while merged Screech uses player boon duration', () => {
  const concentrationBonus = rangerCatalog.balanceProfilesById.get(TRAIT.LINGERING_MAGIC).attributeBonuses
    .concentration;
  for (const trait of [false, true]) {
    const result = runRanger([ID.QUICKENING_SCREECH_PET, wait(1000)], {
      ...hawk,
      attributeInputs: baseAttributeInputs({
        concentration: 1500,
        boonDurationBonus: 50,
        boonDurationBonuses: { swiftness: 50 }
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
    // Player priority leaves no companion slot in a full party.
    assert.equal(boon.resolvedAudience.alliedPlayerCount, 4);
    assert.deepEqual(boon.resolvedAudience.companionIds, []);
    assert.equal(boon.resolvedAudience.recipientCount, 5);
    assert.equal(boon.actorType, 'summon');
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
});

// The pet and the merged player can both finish the ranger's field.
test('pet and merged Swoop perform leap combos in a Frost Trap', () => {
  for (const [specialization, skillId] of [
    ['Untamed', ID.BIRD_SWOOP],
    ['Soulbeast', ID.SWOOP_ID_44991]
  ]) {
    const result = runRanger([ID.FROST_TRAP, wait(600), skillId, wait(1500)], { ...hawk, specialization });
    assert.deepEqual(result.warnings, []);
    assert.ok(
      result.resolvedEvents.some(
        (event) => event.type === 'combo' && event.finisherType === 'Leap' && event.fieldType === 'Ice'
      )
    );
  }
});

// Cancelling the channel preserves only landed pulses and their matching condition packets.
test('Primal Cry applies one set of conditions per surviving pulse', () => {
  const survivingHits = [];
  for (const interruptAfterMs of [undefined, 300]) {
    const result = runRanger([{ type: 'cast', skillId: ID.PRIMAL_CRY, interruptAfterMs }, wait(1500)], {
      selectedPet: 'Hawk',
      specialization: 'Soulbeast'
    });
    assert.deepEqual(result.warnings, []);
    const hits = result.events.filter((event) => event.type === 'damage' && event.skillId === ID.PRIMAL_CRY);
    assert.ok(hits.length > 0);
    survivingHits.push(hits.length);
    for (const condition of ['Poisoned', 'Bleeding', 'Vulnerability']) {
      const applications = result.events.filter(
        (event) => event.type === 'condition' && event.skillId === ID.PRIMAL_CRY && event.condition === condition
      );
      assert.equal(applications.length, hits.length);
      for (const [index, hit] of hits.entries()) {
        assert.equal(applications[index].at, hit.at);
        assert.ok(applications[index].eventOrder > hit.eventOrder);
      }
    }
  }

  assert.ok(survivingHits[1] < survivingHits[0]);
});
