import assert from 'node:assert/strict';
import test from 'node:test';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { rangerPetCombatMetadata } from '#gw2/professions/ranger/core/mechanics/pets.js';
import { runRanger } from '#tests/helpers/ranger-simulation.js';
import { assertFlooredDamageMultiplier } from '#tests/helpers/rounded-damage.js';

// Minimal packets isolate the family multiplier from each pet's AI rotation and critical-hit RNG.
function simulate(selectedPet, selected, swap = false) {
  return runRanger(
    [...(swap ? ['Swap Pets'] : []), { type: 'wait', durationMs: 2500 }],
    { selectedPet, selectedPet2: 'Lynx', selectedTraitIds: selected ? [TRAIT.BEASTLY_WARDEN] : [] },
    {
      initialize(runtime) {
        const pet = rangerPetCombatMetadata(runtime);
        for (const [source, actorType, metadata] of [
          ['ranger-pet', 'summon', pet],
          ['ranger', 'player', {}]
        ]) {
          runtime.emit({
            type: 'damage',
            at: 1,
            source,
            sourceId: 'warden-fixture',
            skillName: 'Warden fixture',
            actorType,
            coefficient: 1,
            canCrit: false,
            weaponStrength: 1000,
            ...metadata
          });
          runtime.emit({
            type: 'condition',
            at: 1,
            source,
            sourceId: 'warden-condition',
            skillName: 'Warden condition',
            actorType,
            condition: 'Bleeding',
            stacks: 1,
            duration: 1,
            ...metadata
          });
        }
      }
    }
  );
}

test('Beastly Warden increases only ursine and porcine pet strike damage by 67 percent', () => {
  const eligible = [
    'Boar',
    'Pig',
    'Siamoth',
    'Wallow',
    'Warthog',
    'Arctodus',
    'Black Bear',
    'Brown Bear',
    'Murellow',
    'Polar Bear'
  ];
  for (const pet of [...eligible, 'Lynx', 'Tiger', 'Fanged Iboga']) {
    const baseline = simulate(pet, false);
    const traited = simulate(pet, true);
    for (const result of [baseline, traited]) assert.deepEqual(result.warnings, [], pet);
    const strike = (result, source) =>
      result.resolvedEvents.find(
        (event) => event.type === 'damage' && event.sourceId === 'warden-fixture' && event.source === source
      );
    assertFlooredDamageMultiplier(
      strike(traited, 'ranger-pet').damage,
      strike(baseline, 'ranger-pet').damage,
      eligible.includes(pet) ? 1.67 : 1
    );
    assert.equal(strike(traited, 'ranger').damage, strike(baseline, 'ranger').damage);
    const conditions = (result) =>
      result.resolvedEvents
        .filter((event) => event.type === 'condition' && event.sourceId === 'warden-condition')
        .map((event) => event.damageTicks);
    assert.deepEqual(conditions(traited), conditions(baseline), pet);
  }
});

// A delayed strike belongs to the old pet even after the active slot changes to an ineligible family.
test('Beastly Warden preserves the launching pet bonus across swaps', () => {
  const baseline = simulate('Pig', false, true);
  const traited = simulate('Pig', true, true);
  for (const result of [baseline, traited]) {
    assert.deepEqual(result.warnings, []);
    assert.equal(result.planningState.profession.activePet, 'Lynx');
  }

  const strike = (result) =>
    result.resolvedEvents.find(
      (event) => event.type === 'damage' && event.sourceId === 'warden-fixture' && event.source === 'ranger-pet'
    );
  assertFlooredDamageMultiplier(strike(traited).damage, strike(baseline).damage, 1.67);
});
