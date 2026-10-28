import assert from 'node:assert/strict';
import test from 'node:test';

import { rangerPetCombatMetadata } from '#gw2/professions/ranger/core/mechanics/pet-attributes.js';
import { swapRangerPets } from '#gw2/professions/ranger/core/skills/actions.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { setBeastmode } from '#gw2/professions/ranger/specializations/soulbeast/mechanics/beastmode-effects.js';
import { runRanger } from '#tests/helpers/ranger-simulation.js';

const wait = (durationMs) => ({ type: 'wait', durationMs });
const config = {
  specialization: 'Untamed',
  initialUntamedState: 'Ranger',
  selectedPet: 'Jacaranda',
  selectedTraitIds: [TRAIT.POISON_MASTER]
};
const procs = (result) =>
  result.resolvedEvents.filter((e) => e.type === 'condition' && e.sourceId === TRAIT.POISON_MASTER);
const grants = (result) => result.events.filter((e) => e.type === 'ranger.poison-master-armed');

// Activation must arm the first pet strike before completion, without granting again when the command finishes.
test('Poison Master is available to Embrace’s initial pet hit and remains Ranger-owned', () => {
  const result = runRanger(['__combat_start', ID.JACARANDAS_EMBRACE, wait(5000)], config);
  assert.deepEqual(result.warnings, []);
  const command = result.events.find((e) => e.type === 'action' && e.skillId === ID.JACARANDAS_EMBRACE);
  const firstHit = result.resolvedEvents.find(
    (e) => e.type === 'damage' && e.skillId === ID.JACARANDAS_EMBRACE && e.actorType === 'summon'
  );
  assert.equal(grants(result).length, 1);
  assert.equal(grants(result)[0].at, command.at);
  assert.ok(firstHit.at < command.endsAt);
  assert.equal(
    procs(result).reduce((n, e) => n + e.stacks, 0),
    2
  );
  for (const proc of procs(result)) {
    assert.equal(proc.at, firstHit.at);
    assert.equal(proc.ownerActorType, 'player');
    assert.equal(proc.summonOwner, undefined);
    assert.equal(proc.summonBaseConditionDamage, undefined);
  }
});

// The reward belongs to the next pet strike, even when an older storm delivers it during the new command.
test('an ongoing Call Lightning pulse can consume a newly activated Beast-skill grant', () => {
  const result = runRanger(
    ['__combat_start', ID.JACARANDA_CALL_LIGHTNING, wait(1500), ID.JACARANDAS_EMBRACE, wait(5000)],
    config
  );
  assert.deepEqual(result.warnings, []);
  const command = result.events.find((e) => e.type === 'action' && e.skillId === ID.JACARANDAS_EMBRACE);
  const firstEmbraceHit = result.resolvedEvents.find(
    (e) => e.type === 'damage' && e.skillId === ID.JACARANDAS_EMBRACE && e.actorType === 'summon'
  );
  assert.equal(
    procs(result).reduce((n, e) => n + e.stacks, 0),
    2
  );
  assert.ok(
    procs(result).every((e) => e.triggeredBy === 'Call Lightning' && e.at >= command.at && e.at < firstEmbraceHit.at)
  );
});

// Cloud hits carry Ranger ownership, so the grant must survive until a genuine Devourer attack arrives.
test('Poisonous Cloud cannot consume Poison Master before Twin Darts', () => {
  const result = runRanger(['__combat_start', ID.POISONOUS_CLOUD, wait(6000)], {
    ...config,
    specialization: 'Druid',
    selectedPet: 'Carrion Devourer'
  });
  assert.deepEqual(result.warnings, []);
  const cloud = result.resolvedEvents.find((e) => e.type === 'damage' && e.skillId === ID.POISONOUS_CLOUD);
  const dart = result.resolvedEvents.find((e) => e.type === 'damage' && e.skillId === ID.TWIN_DARTS);
  assert.ok(cloud.at < dart.at);
  assert.equal(
    procs(result).reduce((n, e) => n + e.stacks, 0),
    2
  );
  assert.ok(procs(result).every((e) => e.triggeredBy === 'Twin Darts' && e.at === dart.at));
});

// Retiring the commanded pet clears its reward; its delayed completion and surviving vines cannot rearm it.
test('swapping during a Beast command cannot grant Poison Master to the replacement', () => {
  const result = runRanger(
    [
      '__combat_start',
      ID.JACARANDAS_EMBRACE,
      { type: 'cast', skillId: ID.PET_SWAP, concurrentOffsetMs: 100 },
      wait(6500)
    ],
    { ...config, specialization: 'Druid', selectedPet2: 'Carrion Devourer' }
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(grants(result).length, 1);
  assert.equal(procs(result).length, 0);
  assert.ok(result.resolvedEvents.some((e) => e.type === 'damage' && e.skillId === ID.TWIN_DARTS && e.damage > 0));
});

// Old caster provenance must not consume a fresh incoming grant, even for effects intentionally surviving retirement.
test('lingering Ranger-owned effects leave the new pet’s Poison Master grant available', () => {
  let outgoing;
  const result = runRanger(
    [wait(1500)],
    { ...config, selectedPet2: 'Carrion Devourer' },
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
                type: 'ranger.poison-master-armed',
                at: runtime.time,
                source: 'Trait',
                sourceId: TRAIT.POISON_MASTER,
                actorType: 'effect',
                summonOwner: incoming.summonOwner
              }
            });
            for (const [at, metadata, actorType] of [
              [0.2, outgoing, 'player'],
              [0.3, incoming, 'player'],
              [0.4, incoming, 'summon'],
              [0.5, incoming, 'summon']
            ]) {
              runtime.effects.emit({
                kind: 'packet',
                event: {
                  ...metadata,
                  type: 'damage',
                  at,
                  coefficient: 0.1,
                  source: 'ranger-pet',
                  sourceId: 'poison-master-consumer',
                  skillName: 'Ownership fixture',
                  actorType
                }
              });
            }
          }
        }
      ]
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.ok(result.resolvedEvents.some((e) => e.type === 'damage' && e.summonOwner === outgoing.summonOwner));
  assert.equal(
    procs(result).reduce((n, e) => n + e.stacks, 0),
    2
  );
  assert.ok(procs(result).every((e) => e.at === 0.4));
});

// Player grants stay player-owned; discarded pet grants cannot cross merge boundaries.
test('Soulbeast keeps player grants separate and discards pet grants across merging', () => {
  runRanger(
    [wait(1000)],
    { ...config, specialization: 'Soulbeast' },
    {
      timeline: [
        {
          at: 0.1,
          run(runtime) {
            const core = runtime.profession.core;
            core.player.poisonMasterReady = true;
            setBeastmode(runtime.mechanics, runtime.helpers.skillsById.get(ID.LEAVE_BEASTMODE), false);
            assert.equal(core.pet.poisonMasterReady, false);
            core.pet.poisonMasterReady = true;
            setBeastmode(runtime.mechanics, runtime.helpers.skillsById.get(ID.BEASTMODE), true);
            assert.equal(core.pet, null);
            assert.equal(core.player.poisonMasterReady, true);
            setBeastmode(runtime.mechanics, runtime.helpers.skillsById.get(ID.LEAVE_BEASTMODE), false);
            assert.equal(core.pet.poisonMasterReady, false);
          }
        }
      ]
    }
  );
});
