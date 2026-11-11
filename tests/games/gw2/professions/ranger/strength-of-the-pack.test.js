import assert from 'node:assert/strict';
import test from 'node:test';

import { rangerPetCombatMetadata } from '#gw2/professions/ranger/core/mechanics/pet-attributes.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { wait } from '#tests/helpers/commands.js';
import { runRanger } from '#tests/helpers/ranger-simulation.js';
import { assertFlooredDamageMultiplier } from '#tests/helpers/rounded-damage.js';

// Player hits grant both recipients Might, without duplicating the merged player grant.
for (const specialization of ['Core', 'Soulbeast']) {
  test(`Strength of the Pack routes on-hit Might without requiring an absent pet (${specialization})`, () => {
    const result = runRanger(['"Strength of the Pack!"', 'Long Range Shot'], {
      specialization,
      primaryWeapon: 'Longbow',
      selectedTraitIds: [],
      boons: {}
    });
    assert.deepEqual(result.warnings, []);
    const might = result.events.filter(
      (event) => event.type === 'buff' && event.skillId === ID.STRENGTH_OF_THE_PACK && event.kind === 'might'
    );
    assert.ok(might.length > 0);
    for (const event of might) {
      assert.equal(event.resolvedAudience.includesSelf, true);
      assert.equal(event.resolvedAudience.companionIds.length, specialization === 'Core' ? 1 : 0);
    }
  });
}

// Hold Might and critical outcomes constant so only the recipient's timed strike bonus changes.
for (const specialization of ['Core', 'Soulbeast']) {
  test(`Strength of the Pack damage follows its recipient and expires (${specialization})`, () => {
    const result = runRanger(
      [ID.STRENGTH_OF_THE_PACK, wait(12000)],
      {
        specialization,
        selectedPet: 'Hawk',
        boons: { might: 25, fury: true }
      },
      {
        initialize(runtime) {
          if (specialization === 'Core')
            runtime.effects.emit({
              kind: 'packet',
              event: {
                type: 'buff',
                at: 0.1,
                actorType: 'effect',
                source: 'test',
                sourceId: 'test-might',
                kind: 'might',
                stacks: 25,
                duration: 60,
                audience: {
                  recipients: 'summons',
                  affectsSelf: false,
                  maximumRecipients: 1,
                  eligibleCompanionIds: [runtime.profession.core.pet.id]
                }
              }
            });
        },
        timeline: [1, 11].map((at) => ({
          at,
          run(runtime) {
            for (const actorType of specialization === 'Core' ? ['player', 'summon'] : ['player'])
              runtime.effects.emit({
                kind: 'packet',
                event: {
                  type: 'damage',
                  at,
                  actorType,
                  source: actorType === 'summon' ? 'ranger-pet' : 'ranger',
                  sourceId: ID.LONG_RANGE_SHOT,
                  skillId: ID.LONG_RANGE_SHOT,
                  skillName: 'Test strike',
                  name: 'Test strike',
                  coefficient: 1,
                  hits: 1,
                  canCrit: false,
                  weaponStrength: 1000,
                  ...(actorType === 'summon'
                    ? { ...rangerPetCombatMetadata(runtime), summonOwner: runtime.profession.core.pet.id }
                    : {})
                }
              });
          }
        }))
      }
    );
    assert.deepEqual(result.warnings, []);
    for (const actorType of specialization === 'Core' ? ['player', 'summon'] : ['player']) {
      const hits = result.resolvedEvents.filter(
        (event) => event.type === 'damage' && event.skillName === 'Test strike' && event.actorType === actorType
      );
      assert.equal(hits.length, 2);
      const multiplier = actorType === 'summon' ? 1.25 : specialization === 'Soulbeast' ? 1.1 : 1;
      assertFlooredDamageMultiplier(hits[0].damage, hits[1].damage, multiplier);
    }
  });
}

test('Strength of the Pack does not transfer its damage grant to a replacement pet', () => {
  const result = runRanger([ID.STRENGTH_OF_THE_PACK, ID.LONG_RANGE_SHOT, ID.PET_SWAP, wait(4000)], {
    primaryWeapon: 'Longbow',
    selectedPet: 'Hawk',
    selectedPet2: 'Tiger'
  });
  assert.deepEqual(result.warnings, []);
  const grant = result.events.find((event) => event.kind === 'strength-of-the-pack-pet');
  assert.equal(grant.resolvedAudience.includesSelf, false);
  assert.equal(grant.resolvedAudience.companionIds.length, 1);
  const newPetHits = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.actorType === 'summon' && event.at > 1
  );
  assert.ok(newPetHits.length > 0);
  assert.ok(newPetHits.every((event) => !grant.resolvedAudience.companionIds.includes(event.summonOwner)));
});
