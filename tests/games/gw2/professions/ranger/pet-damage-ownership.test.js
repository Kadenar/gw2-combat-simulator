import { rangerPetForState } from '#gw2/professions/ranger/data/pets.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { runRanger } from '#tests/helpers/ranger-simulation.js';
import { withProfile } from '#tests/helpers/catalog-overrides.js';
import { grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { rangerPetCombatMetadata } from '#gw2/professions/ranger/core/mechanics/pet-attributes.js';
import { swapRangerPets } from '#gw2/professions/ranger/core/skills/actions.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';

const wait = (durationMs) => ({ type: 'wait', durationMs });

// Command preemption must cancel an unfinished autonomous attack and all conditions derived from its missing hit.
test('a pet command interrupts Twin Darts before it can deliver strikes or conditions', () => {
  const result = runRanger(['__combat_start', wait(600), ID.POISONOUS_CLOUD, wait(7000)], {
    selectedPet: 'Carrion Devourer',
    selectedTraitIds: [TRAIT.ARACHNOPHOBIA, TRAIT.SHARPENED_EDGES]
  });
  assert.deepEqual(result.warnings, []);
  const interrupted = result.events.find((event) => event.type === 'action' && event.skillId === ID.TWIN_DARTS);
  assert.ok(interrupted.interrupted);
  assert.equal(
    result.resolvedEvents.some(
      (event) => event.activationId === interrupted.activationId && ['damage', 'condition'].includes(event.type)
    ),
    false
  );
  const command = result.events.find((event) => event.type === 'action' && event.skillId === ID.POISONOUS_CLOUD);
  const following = result.events.find(
    (event) => event.type === 'action' && event.skillId === ID.TWIN_DARTS && event.at > command.at
  );
  assert.ok(following && following.at >= command.endsAt);
});

// Swapping destroys the outgoing grant rather than transferring it or saving it for the pet's return.
test('pet swaps discard unspent Poisonous Strikes charges', () => {
  for (const charges of [1, 2]) {
    runRanger(
      [wait(1000)],
      { selectedPet: 'Jacaranda', selectedPet2: 'Carrion Devourer' },
      {
        initialize(runtime) {
          runtime.profession.core.pet.poisonousStrikes = grantCharges(charges, 7);
        },
        timeline: [
          {
            at: 0.1,
            run(runtime) {
              assert.equal(runtime.profession.core.pet.poisonousStrikes.charges, charges);
              swapRangerPets(runtime.mechanics, runtime.helpers.skillsById.get(ID.PET_SWAP));
              assert.equal(rangerPetForState(runtime.profession.core).name, 'Carrion Devourer');
              assert.equal(runtime.profession.core.pet.poisonousStrikes.charges, 0);
            }
          },
          {
            at: 0.3,
            run(runtime) {
              swapRangerPets(runtime.mechanics, runtime.helpers.skillsById.get(ID.PET_SWAP));
              assert.equal(rangerPetForState(runtime.profession.core).name, 'Jacaranda');
              assert.equal(runtime.profession.core.pet.poisonousStrikes.charges, 0);
            }
          }
        ]
      }
    );
  }
});

// A surviving player-owned effect cannot consume a fresh grant received by the incoming companion after swapping.
test('retired pet effects cannot consume Poisonous Strikes newly granted after a swap', () => {
  let outgoing;
  const result = runRanger(
    [wait(1500)],
    { selectedPet: 'Jacaranda', selectedPet2: 'Carrion Devourer' },
    {
      initialize(runtime) {
        outgoing = rangerPetCombatMetadata(runtime);
      },
      timeline: [
        {
          at: 0.1,
          run(runtime) {
            swapRangerPets(runtime.mechanics, runtime.helpers.skillsById.get(ID.PET_SWAP));
            const incoming = rangerPetCombatMetadata(runtime);
            runtime.effects.emit({
              kind: 'packet',
              event: {
                type: 'ranger.poisonous-strikes',
                summonOwner: incoming.summonOwner,
                at: runtime.time,
                charges: 2,
                duration: 7,
                source: 'ranger',
                sourceId: ID.DOUBLE_ARC,
                actorType: 'player'
              }
            });
            for (const [at, pet, actorType] of [
              [0.2, outgoing, 'player'],
              [0.25, incoming, 'player'],
              [0.3, incoming, 'summon'],
              [0.4, incoming, 'summon']
            ]) {
              runtime.effects.emit({
                kind: 'packet',
                event: {
                  ...pet,
                  type: 'damage',
                  at,
                  coefficient: 0.1,
                  source: 'ranger-pet',
                  sourceId: 'charge-consumer',
                  skillName: 'Charge consumer',
                  actorType,
                  independentConditionOwner: actorType === 'summon'
                }
              });
            }
          }
        }
      ]
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.ok(
    result.resolvedEvents.some((event) => event.type === 'damage' && event.summonOwner === outgoing.summonOwner)
  );
  const poison = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillName === 'Poisonous Strikes'
  );
  assert.equal(poison.length, 2);
  assert.ok(
    poison.every((event) => event.entityName === 'Carrion Devourer' && event.summonOwner !== outgoing.summonOwner)
  );
});

// Swap retirement cancels a live storm and its future critical-hit rewards, while settled damage remains credited.
test('Call Lightning and its Sharpened Edges rewards stop when Jacaranda is swapped out', () => {
  const result = runRanger(
    ['__combat_start', ID.JACARANDA_CALL_LIGHTNING, wait(4500), ID.PET_SWAP, wait(7000)],
    {
      specialization: 'Untamed',
      selectedPet: 'Jacaranda',
      selectedPet2: 'Carrion Devourer',
      initialUntamedState: 'Ranger',
      selectedTraitIds: [TRAIT.SHARPENED_EDGES],
      boons: { fury: true },
      sharePlayerBoonsWithSummons: true
    },
    {
      // Guarantee a pre-retirement proc so the lifetime assertion cannot pass on an empty condition history.
      catalog: (catalog) => withProfile(catalog, TRAIT.SHARPENED_EDGES, { criticalChance: 1 })
    }
  );
  assert.deepEqual(result.warnings, []);
  const swappedAt = result.events.find((event) => event.type === 'ranger.pet-swapped').at;
  const strikes = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillId === ID.JACARANDA_CALL_LIGHTNING
  );
  assert.ok(strikes.some((event) => event.damage > 0));
  assert.ok(strikes.every((event) => event.at < swappedAt));
  assert.equal(
    result.resolvedEvents.some(
      (event) => event.type === 'condition' && event.triggeredBy === 'Call Lightning' && event.at >= swappedAt
    ),
    false
  );
  const bleeds = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.triggeredBy === 'Call Lightning'
  );
  assert.ok(bleeds.length > 0);
  assert.ok(bleeds.every((event) => event.damageTicks.every((tick) => tick.at <= swappedAt)));
});
