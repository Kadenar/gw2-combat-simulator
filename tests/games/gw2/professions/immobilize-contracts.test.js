import { baseAttributeInputs } from '#gw2/platform/builds/attribute-inputs.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { rangerPetCombatMetadata } from '#gw2/professions/ranger/core/mechanics/pet-attributes.js';
import { createObservedProfessionSimulator } from '#tests/helpers/observed-runtime.js';
import { runRanger } from '#tests/helpers/ranger-simulation.js';
import assert from 'node:assert/strict';
import test from 'node:test';

const immobilizes = (result) =>
  result.resolvedEvents.filter((event) => event.type === 'condition' && event.condition === 'Immobilized');

test('Advancing Strike immobilizes at its first impact without refreshing on the second', () => {
  // A minimal two-hit cast isolates the application boundary from an entire rotation.
  const result = createObservedProfessionSimulator(guardianProfession, {})('Willbender', ['Advancing Strike'], {
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Sword'
  });
  const impacts = result.resolvedEvents.filter((event) => event.type === 'damage');
  assert.equal(immobilizes(result).length, 1);
  assert.equal(immobilizes(result)[0].at, impacts[0].at);
  assert.equal(immobilizes(result)[0].duration, 1);
  assert.deepEqual(result.warnings, []);
});

test('Tainted Shackles immobilizes at the final impact after its cast has completed', () => {
  // The observation tail must execute the delayed binding independently of the player's next action.
  const result = createObservedProfessionSimulator(necromancerProfession, {})(
    'Core',
    ['Death Shroud', 'Tainted Shackles'],
    { initialResource: 100 },
    { kind: 'tail', durationMs: 5000 }
  );
  const finalStrike = result.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillName === 'Tainted Shackles'
  );
  const cast = result.events.find((event) => event.type === 'action' && event.skillName === 'Tainted Shackles');
  assert.equal(immobilizes(result).length, 1);
  assert.equal(immobilizes(result)[0].at, finalStrike.at);
  assert.equal(immobilizes(result)[0].duration, 2);
  assert.ok(finalStrike.at > cast.endsAt);
  assert.deepEqual(result.warnings, []);
});

test('Radiant Courage immobilize requires an empowered blade impact and consumes its entitlement once', () => {
  // Cancellation and off-target impacts cannot apply the condition; an ordinary second blade is unempowered.
  const simulate = createObservedProfessionSimulator(guardianProfession, {});
  for (const [armed, blades, expected] of [
    [true, ['Gleaming Blade', 'Gleaming Blade'], 1],
    [false, ['Gleaming Blade'], 0],
    [true, [{ name: 'Gleaming Blade', interruptMs: 0 }], 0],
    [true, [{ name: 'Gleaming Blade', offTarget: true }, 'Gleaming Blade'], 0]
  ]) {
    const result = simulate(
      'Luminary',
      [...(armed ? ['Radiant Courage'] : []), 'Enter Radiant Forge', ...blades],
      {},
      { kind: 'tail', durationMs: 2000 }
    );
    assert.equal(immobilizes(result).length, expected);
    if (expected) {
      const impact = result.resolvedEvents.find(
        (event) => event.type === 'damage' && event.skillName === 'Gleaming Blade'
      );
      assert.equal(immobilizes(result)[0].at, impact.at);
      assert.equal(immobilizes(result)[0].duration, 2);
    }

    assert.deepEqual(result.warnings, []);
  }
});

test('Paralyzing Venom belongs to one pet, expires, and is consumed by its next accepted strike', () => {
  // Scheduled pet hits isolate charge consumption from pet AI; player strikes and misses cannot spend the charge.
  for (const [firstHitAt, swap, expected] of [
    [1, false, 1],
    [21, false, 0],
    [2, true, 0]
  ]) {
    const result = runRanger(
      [
        'Paralyzing Venom',
        ...(swap ? [{ type: 'wait', durationMs: 1000 }, 'Swap Pets'] : []),
        { type: 'wait', durationMs: 23_000 }
      ],
      {
        selectedPet: 'Jungle Spider',
        selectedPet2: 'Black Widow Spider',
        attributeInputs: baseAttributeInputs({ expertise: 1500 })
      },
      {
        initialize(runtime) {
          const pet = rangerPetCombatMetadata(runtime);
          for (const [at, actorType, offTarget] of [
            [0.7, 'player', false],
            [0.8, 'summon', true],
            [firstHitAt, 'summon', false],
            [firstHitAt + 1, 'summon', false]
          ]) {
            runtime.effects.emit({
              kind: 'packet',
              event: {
                type: 'damage',
                at,
                source: actorType === 'summon' ? 'ranger-pet' : 'ranger',
                sourceId: 'venom-fixture',
                skillName: 'Venom fixture',
                actorType,
                coefficient: 1,
                canCrit: false,
                weaponStrength: 1000,
                offTarget,
                ...(actorType === 'summon' ? pet : {})
              }
            });
          }
        }
      }
    );
    assert.equal(immobilizes(result).length, expected);
    if (expected) {
      const application = immobilizes(result)[0];
      assert.equal(application.at, firstHitAt);
      assert.equal(application.duration, 3);
      assert.equal(application.actorType, 'summon');
      assert.equal(application.summonOwner, 'ranger-pet:1:0');
    }

    assert.deepEqual(result.warnings, []);
  }
});
