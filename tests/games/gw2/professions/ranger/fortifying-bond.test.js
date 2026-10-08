import { simulationEventLogRows } from '#gw2/app/results/event-log.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { rangerPetCompanionId } from '#gw2/professions/ranger/core/mechanics/pet-attributes.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { rangerProfession } from '#gw2/professions/ranger/profession.js';
import { runRanger } from '#tests/helpers/ranger-simulation.js';
import assert from 'node:assert/strict';
import test from 'node:test';

// Received boons exercise live recipient resolution and sharing without treating arbitrary NPC grants as console pulses.
test('Fortifying Bond shares only player-sourced self boons and scales its durations with ranger stats', () => {
  for (const specialization of ['Core', 'Untamed', 'Soulbeast']) {
    for (const selected of [false, true]) {
      let petId;
      const result = runRanger(
        [{ type: 'wait', durationMs: 1000 }],
        {
          specialization,
          selectedPet: 'Tiger',
          selectedTraitIds: selected ? [TRAIT.FORTIFYING_BOND] : [],
          sharePlayerBoonsWithSummons: false,
          stats: { concentration: 750 }
        },
        {
          extend: (native) => ({
            buffPolicies: (runtime) => [...native.buffPolicies(runtime), { kind: 'custom-buff' }]
          }),
          initialize(runtime) {
            petId = rangerPetCompanionId(runtime);
            for (const [index, grant] of [
              { kind: 'might', stacks: 4, actorType: 'player' },
              { kind: 'quickness', actorType: 'player', metadata: { triggeredByAlly: 1 } },
              { kind: 'fury', actorType: 'effect', source: 'Trait' },
              { kind: 'protection', actorType: 'environment' },
              { kind: 'vigor', actorType: 'summon', summonOwner: petId, audience: { recipients: 'party' } },
              { kind: 'aegis', actorType: 'effect', ownerActorType: 'summon' },
              { kind: 'resolution', actorType: 'player', audience: { recipients: 'party', affectsSelf: false } },
              { kind: 'custom-buff', actorType: 'player' }
            ].entries())
              runtime.effects.emit({
                kind: 'packet',
                event: {
                  type: 'buff',
                  at: index / 10,
                  duration: 30,
                  stacks: 1,
                  source: 'test',
                  sourceId: 'received-boon',
                  ...grant
                }
              });
          }
        }
      );
      assert.deepEqual(result.warnings, []);
      const shared = result.events.filter((event) => event.sourceId === TRAIT.FORTIFYING_BOND);
      if (!selected || specialization === 'Soulbeast') {
        assert.deepEqual(shared, []);
        continue;
      }

      assert.deepEqual(
        shared.map(({ kind, stacks, duration }) => [kind, stacks, duration]),
        [
          ['might', 4, 15],
          ['quickness', 1, 3.75],
          ['fury', 1, 7.5]
        ]
      );
      for (const event of shared) {
        assert.equal(event.resolvedAudience.includesSelf, false);
        assert.deepEqual(event.resolvedAudience.companionIds, [petId]);
      }
    }
  }
});

// Direct party delivery and the received-boon trait are separate grants to the same active companion.
test('Let Loose selects the pet for party boons while Fortifying Bond works with direct sharing disabled', () => {
  for (const sharePlayerBoonsWithSummons of [false, true]) {
    const result = runRanger([ID.UNLEASH_RANGER, ID.RELENTLESS_WHIRL], {
      specialization: 'Untamed',
      initialUntamedState: 'Pet',
      primaryWeapon: 'Hammer',
      selectedPet: 'Tiger',
      selectedTraitIds: [TRAIT.LET_LOOSE, TRAIT.FORTIFYING_BOND],
      sharePlayerBoonsWithSummons
    });
    assert.deepEqual(result.warnings, []);
    const direct = result.events.find((event) => event.type === 'buff' && event.sourceId === TRAIT.LET_LOOSE);
    const shared = result.events.find((event) => event.sourceId === TRAIT.FORTIFYING_BOND);
    assert.equal(direct.resolvedAudience.includesSummons, sharePlayerBoonsWithSummons);
    assert.equal(shared.resolvedAudience.includesSummons, true);
    assert.equal(shared.resolvedAudience.includesSelf, false);
  }
});

// Sharing Fury grants its ordinary pet bonus without leaking the player's Vicious Quarry modifier.
test('Vicious Quarry leaves independent pet critical chance unchanged', () => {
  const chances = [false, true].map((selected) => {
    const result = runRanger([ID.WE_HEAL_AS_ONE, ID.FELINE_BITE], {
      specialization: 'Untamed',
      initialUntamedState: 'Ranger',
      selectedPet: 'Tiger',
      selectedTraitIds: selected ? [TRAIT.VICIOUS_QUARRY] : [],
      boons: { fury: true }
    });
    assert.deepEqual(result.warnings, []);
    return result.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === ID.FELINE_BITE)
      .criticalChance;
  });
  assert.equal(chances[0], chances[1]);
});

// Console boons reach the ranger first; Bond refreshes the pet independently of direct party delivery.
test('Fortifying Bond copies configured console boons on each pulse, except in Beastmode', () => {
  for (const specialization of ['Untamed', 'Soulbeast']) {
    const result = runRanger([{ type: 'wait', durationMs: 6500 }], {
      specialization,
      selectedTraitIds: [TRAIT.FORTIFYING_BOND],
      sharePlayerBoonsWithSummons: false,
      stats: { concentration: 750 },
      boons: { alacrity: true, might: 25, fury: false }
    });
    assert.deepEqual(result.warnings, []);
    const shared = result.events.filter((event) => event.sourceId === TRAIT.FORTIFYING_BOND);

    if (specialization === 'Soulbeast') {
      assert.deepEqual(shared, []);
      continue;
    }

    assert.deepEqual(
      shared.map(({ at, kind, stacks, duration }) => [at, kind, stacks, duration]),
      [
        [0, 'alacrity', 1, 4.5],
        [0, 'might', 25, 15],
        [3, 'alacrity', 1, 4.5],
        [3, 'might', 25, 15],
        [6, 'alacrity', 1, 4.5],
        [6, 'might', 25, 15]
      ]
    );
    assert.ok(shared.every((event) => event.resolvedAudience.includesSummons && !event.resolvedAudience.includesSelf));
  }
});

// Suppression is a display rule: raw Bond grants remain available to boon and damage calculations.
test('event log hides Ranger boon copies and retains ordinary skill buffs', () => {
  const events = [
    {
      type: 'buff',
      at: 0,
      sourceId: TRAIT.FORTIFYING_BOND,
      kind: 'might',
      stacks: 25,
      duration: 10,
      triggeredBy: 'Training console'
    },
    {
      type: 'buff',
      at: 1,
      sourceId: TRAIT.FORTIFYING_BOND,
      kind: 'stability',
      stacks: 10,
      duration: 5,
      triggeredBy: "Forest's Fortification"
    },
    { type: 'buff', at: 1, sourceId: ID.FORESTS_FORTIFICATION, kind: 'stability', stacks: 10, duration: 6 }
  ];
  for (const sourceId of [TRAIT.RESOUNDING_TIMBRE, ID.WE_HEAL_AS_ONE]) {
    events.push({ type: 'buff', at: 1, sourceId, kind: 'might', stacks: 25, duration: 10 });
  }

  const rows = simulationEventLogRows({ events, resolvedEvents: [] }, null, withPatchPreview(rangerProfession));
  assert.deepEqual(
    rows.map((row) => row.description),
    ['BUFF Stability x10 (6s)']
  );
  assert.equal(events.length, 5);
});
