import assert from 'node:assert/strict';
import test from 'node:test';
import { createGw2TimelineIndex } from '#gw2/platform/combat/query/timeline-index.js';
import { gw2BoonApplicationRecipients } from '#gw2/platform/combat/state/allied-players.js';
import { recordBuffApplication } from '#gw2/platform/combat/state/boons.js';
import { createRangerCoreState } from '#gw2/professions/ranger/core/state.js';
import { handleRangerPetSwapped } from '#gw2/professions/ranger/core/mechanics/event-handlers.js';
import { rangerPetCompanionId } from '#gw2/professions/ranger/core/mechanics/pets.js';
import { rangerActiveBoonCount, rangerBoonActive } from '#gw2/professions/ranger/core/traits/modifier-queries.js';
import { soulbeastModifierRules } from '#gw2/professions/ranger/specializations/soulbeast/mechanics/beastmode.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';

// Use production recipient selection so boon queries honor sharing policy and party caps.
function buff(kind, audience, config = {}) {
  const event = { type: 'buff', source: 'Fixture', actorType: 'player', at: 4, duration: 2, stacks: 1, kind, audience };
  return { ...event, resolvedAudience: gw2BoonApplicationRecipients(config, event) };
}

test('Ranger and Soulbeast standard boons use live player recipients and duration stacking', () => {
  const self = buff('fury', { recipients: 'self' });
  const context = {
    time: 4,
    traits: new Set([TRAIT.FURIOUS_STRENGTH]),
    timeline: createGw2TimelineIndex({ events: [self] }),
    runtime: { boons: new Map() }
  };
  const furiousStrength = soulbeastModifierRules.find(({ id }) => id === 'ranger.furious-strength');
  assert.equal(rangerBoonActive({ ...context, runtime: undefined }, 'fury'), true);
  for (const audience of [
    { recipients: 'party', affectsSelf: false },
    { recipients: 'summons', affectsSelf: false, eligibleCompanionIds: ['pet'] }
  ]) {
    recordBuffApplication(context.runtime.boons, buff('fury', audience, { allies: { count: 4 } }));
  }

  assert.equal(rangerActiveBoonCount(context, 'player'), 0);
  assert.equal(furiousStrength.when(context), false);
  recordBuffApplication(context.runtime.boons, self);
  recordBuffApplication(context.runtime.boons, self);
  assert.equal(furiousStrength.when(context), true);
  assert.equal(rangerActiveBoonCount({ ...context, time: 3 }, 'player'), 0);
  assert.equal(rangerActiveBoonCount({ ...context, time: 6 }, 'player'), 1);
  assert.equal(furiousStrength.when({ ...context, time: 8 }), false);
  assert.equal(rangerActiveBoonCount({ time: 8, config: { boons: { fury: true, might: 25 } } }, 'player'), 2);
  assert.equal(rangerBoonActive({ time: 4 }, 'fury'), false);
  // Custom pet-command keys keep their prior partial-context behavior.
  assert.equal(rangerBoonActive({ time: 4, timeline: { timedActive: () => true } }, 'sic-em-pet'), true);
});

test('pet boon counts follow packet identity across swaps and exclude future same-time applications', () => {
  const runtime = {
    profession: { core: createRangerCoreState() },
    boons: new Map(),
    conditionState: new Map(),
    conditionApplications: []
  };
  const oldPet = rangerPetCompanionId(runtime);
  const fury = buff('fury', { recipients: 'summons', affectsSelf: false, eligibleCompanionIds: [oldPet] });
  const context = {
    time: 4,
    event: { actorType: 'summon', source: 'ranger-pet', summonOwner: oldPet },
    timeline: createGw2TimelineIndex({ events: [fury] }),
    runtime
  };
  assert.equal(rangerActiveBoonCount({ ...context, runtime: undefined }, 'pet'), 1);
  assert.equal(rangerActiveBoonCount(context, 'pet'), 0);
  recordBuffApplication(runtime.boons, fury);
  recordBuffApplication(runtime.boons, fury);
  assert.equal(rangerActiveBoonCount({ ...context, time: 3 }, 'pet'), 0);
  assert.equal(rangerActiveBoonCount({ ...context, time: 6 }, 'pet'), 1);
  assert.equal(rangerActiveBoonCount({ ...context, time: 8 }, 'pet'), 0);

  handleRangerPetSwapped(runtime, { at: 5, activePet: 'Smokescale', activePetSlot: 2 });
  const newPet = rangerPetCompanionId(runtime);
  assert.notEqual(newPet, oldPet);
  const incoming = { ...context, time: 5, event: { ...context.event, summonOwner: newPet } };
  assert.equal(rangerActiveBoonCount(incoming, 'pet'), 0);
  assert.equal(rangerActiveBoonCount({ ...incoming, runtime: undefined }, 'pet'), 0);
  // A delayed old-pet packet still queries its own recipient identity after the swap.
  assert.equal(rangerActiveBoonCount({ ...context, time: 5 }, 'pet'), 1);
  recordBuffApplication(runtime.boons, {
    ...buff('might', { recipients: 'summons', affectsSelf: false, eligibleCompanionIds: [newPet] }),
    at: 5
  });
  assert.equal(rangerActiveBoonCount(incoming, 'pet'), 1);
  assert.equal(rangerActiveBoonCount({ ...context, time: 5 }, 'pet'), 1);
  assert.equal(rangerActiveBoonCount({ ...context, event: undefined }, 'pet'), 0);
});

test('pet boon queries honor resolved party caps and explicit summon grants in both query modes', () => {
  for (const [allies, share, recipients, expectedPetBoons] of [
    [2, true, 'party', 1],
    [4, true, 'party', 0],
    [2, false, 'party', 0],
    [4, false, 'summons', 1],
    [0, true, 'self', 0]
  ]) {
    const config = { allies: { count: allies }, sharePlayerBoonsWithSummons: share, boons: { fury: true } };
    const event = buff('might', { recipients, eligibleCompanionIds: ['pet'] }, config);
    const runtime = { boons: new Map() };
    recordBuffApplication(runtime.boons, event);
    const context = {
      config,
      time: 4,
      event: { actorType: 'summon', source: 'ranger-pet', summonOwner: 'pet' },
      timeline: createGw2TimelineIndex({ config, events: [event] })
    };
    assert.equal(rangerActiveBoonCount(context, 'pet'), expectedPetBoons);
    assert.equal(rangerActiveBoonCount({ ...context, runtime }, 'pet'), expectedPetBoons);
  }
});
