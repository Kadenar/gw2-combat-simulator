import assert from 'node:assert/strict';
import test from 'node:test';

import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { rangerCatalog as rangerTraitCatalog } from '#gw2/professions/ranger/catalog.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { untamedStrike } from '#gw2/professions/ranger/specializations/untamed/mechanics/unleash-effects.js';
import { untamedState } from '#gw2/professions/ranger/specializations/untamed/state.js';
import { selectedTraits } from '#gw2/professions/shared/trait-data.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { runRanger } from '#tests/helpers/ranger-simulation.js';
import { assertFlooredDamageMultiplier } from '#tests/helpers/rounded-damage.js';

// Match the supplied build's traits and signet; gear is fixed to isolate FS's relative bonus.
const config = {
  specialization: 'Untamed',
  primaryWeapon: 'Hammer',
  selectedPet: 'Tiger',
  selectedSkillIds: [12491],
  selectedTraitIds: selectedTraits(rangerTraitCatalog, [
    { name: 'Marksmanship', traits: '1-1-1' },
    { name: 'Skirmishing', traits: '1-2-3' },
    { name: 'Untamed', traits: '3-1-3' }
  ]).map((trait) => trait.id),
  attributeInputs: baseAttributeInputs({ power: 2000, precision: 1000, ferocity: 0 })
};

test('Ferocious Symbiosis buffs the tiger only when the ranger attacks', () => {
  // Compare identical short scenarios with only FS disabled, avoiding other build modifiers in the ratio.
  for (const attacks of [false, true]) {
    const rotation = [
      '__combat_start',
      ...(attacks
        ? Array.from({ length: 4 }, () => ['Hammer Strike', 'Hammer Slam', 'Heavy Smash']).flat()
        : [{ type: 'wait', durationMs: 10000 }])
    ];
    const result = runRanger(rotation, config);
    const baseline = runRanger(rotation, {
      ...config,
      selectedTraitIds: config.selectedTraitIds.filter((id) => id !== TRAIT.FEROCIOUS_SYMBIOSIS)
    });
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(baseline.warnings, []);
    const state = result.planningState.profession;
    const pet = state[STATE.PET];
    assert.equal(state[STATE.FEROCIOUS_SYMBIOSIS_PLAYER].stacks, 5);
    assert.equal(pet.ferociousSymbiosis.stacks, attacks ? 5 : 0);
    const lastPetHit = (run) =>
      run.resolvedEvents.findLast((event) => event.type === 'damage' && event.source === 'ranger-pet');
    assertFlooredDamageMultiplier(lastPetHit(result).damage, lastPetHit(baseline).damage, attacks ? 1.25 : 1);
  }
});

test('Ferocious Symbiosis independently throttles, caps, refreshes, and expires each beneficiary', () => {
  // Use the live proc controller with precisely spaced hits to isolate the cooldown and refresh contract.
  const runtime = observedRuntime(runRanger([], { ...config, selectedTraitIds: [TRAIT.FEROCIOUS_SYMBIOSIS] }));
  const state = untamedState.from(runtime);
  const pet = runtime.profession.core.pet;
  const hit = (at, pet = false) =>
    runtime.fireTrigger(untamedStrike, {
      event: {
        type: 'damage',
        at,
        coefficient: 1,
        source: pet ? 'ranger-pet' : 'ranger',
        summonOwner: pet ? runtime.profession.core.pet.id : undefined,
        actorType: pet ? 'summon' : 'player'
      }
    });
  for (const pet of [false, true]) {
    hit(1, pet);
    hit(1.25, pet);
  }

  for (const pool of [state.ferociousSymbiosisPlayer, pet.ferociousSymbiosis]) {
    assert.equal(pool.stacks, 1);
    assert.equal(pool.expiresAt, 6);
  }

  hit(1.6, true);
  for (const at of [1.6, 2.2, 2.8, 3.4, 4]) hit(at);
  assert.equal(state.ferociousSymbiosisPlayer.stacks, 2);
  assert.equal(state.ferociousSymbiosisPlayer.expiresAt, 6.6);
  assert.equal(pet.ferociousSymbiosis.stacks, 5);
  assert.equal(pet.ferociousSymbiosis.expiresAt, 9);

  const petEvent = {
    source: 'ranger-pet',
    summonOwner: pet.id,
    actorType: 'summon',
    independentSummonStrike: true,
    summonUsesProfessionModifiers: true
  };
  assert.equal(runtime.query.strikeMultiplier(petEvent, 8.99, runtime), 1.25);
  assert.equal(runtime.query.strikeMultiplier(petEvent, 9, runtime), 1);
  const playerEvent = { source: 'ranger', actorType: 'player' };
  assert.equal(runtime.query.strikeMultiplier(playerEvent, 6.59, runtime), 1.1);
  assert.equal(runtime.query.strikeMultiplier(playerEvent, 6.6, runtime), 1);
  hit(9);
  assert.equal(pet.ferociousSymbiosis.stacks, 1);
  assert.equal(pet.ferociousSymbiosis.expiresAt, 14);
});

test('Ranger-owned pet skill damage uses player Symbiosis even when the pet has different stacks', () => {
  const runtime = observedRuntime(runRanger([], { ...config, selectedTraitIds: [TRAIT.FEROCIOUS_SYMBIOSIS] }));
  const state = untamedState.from(runtime);
  const pet = runtime.profession.core.pet;
  // Caster provenance remains pet-owned, but damage modifiers follow the packet's player ownership.
  const cloud = { source: 'ranger-pet', actorType: 'player', summonOwner: pet.id };
  state.ferociousSymbiosisPlayer = { stacks: 5, expiresAt: 10 };
  pet.ferociousSymbiosis = { stacks: 0, expiresAt: 10 };
  assert.equal(runtime.query.strikeMultiplier(cloud, 1, runtime), 1.25);
  state.ferociousSymbiosisPlayer.stacks = 0;
  pet.ferociousSymbiosis.stacks = 5;
  assert.equal(runtime.query.strikeMultiplier(cloud, 1, runtime), 1);
});
