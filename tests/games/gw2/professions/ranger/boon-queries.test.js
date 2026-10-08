import { createGw2TimelineIndex } from '#gw2/platform/combat-calculation/timeline-index.js';
import { recordBuffApplication } from '#gw2/platform/combat/boons.js';
import { boonActive } from '#gw2/platform/combat/query/runtime-query.js';
import { gw2BoonApplicationRecipients } from '#gw2/platform/combat/state/allied-players.js';
import { createMechanicCombatServices } from '#gw2/platform/resolver/mechanic-services.js';
import { handleRangerPetSwapped } from '#gw2/professions/ranger/core/mechanics/event-handlers.js';
import { rangerPetCompanionId } from '#gw2/professions/ranger/core/mechanics/pet-attributes.js';
import { createRangerCoreState } from '#gw2/professions/ranger/core/state.js';
import { rangerActiveBoonCount } from '#gw2/professions/ranger/core/traits/modifier-queries.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { soulbeastModule } from '#gw2/professions/ranger/specializations/soulbeast/module.js';
import assert from 'node:assert/strict';
import test from 'node:test';

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
    runtime: { boons: new Map(), buffs: new Map() }
  };
  const furiousStrength = soulbeastModule.modifiers.modifierRules.find(({ id }) => id === 'ranger.furious-strength');
  assert.equal(boonActive({ ...context, runtime: undefined }, 'fury'), true);
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
  assert.equal(boonActive({ time: 4 }, 'fury'), false);
  // Pure boon queries cannot retrieve custom pet-command windows.
  assert.equal(boonActive({ time: 4, timeline: { timedActive: () => true } }, 'sic-em-pet'), false);
});

test('pet retirement clears live boon queries while preserving pre-swap history', () => {
  const runtime = {
    profession: { core: createRangerCoreState() },
    boons: new Map(),
    buffs: new Map(),
    retiredCompanions: new Map(),
    conditionState: new Map()
  };
  // Bind real owner operations for this focused mechanic fixture.
  runtime.combat = createMechanicCombatServices(runtime);
  const oldPet = rangerPetCompanionId(runtime);
  const fury = buff('fury', { recipients: 'summons', affectsSelf: false, eligibleCompanionIds: [oldPet] });
  const history = [fury];
  const context = {
    time: 4,
    event: { actorType: 'summon', source: 'ranger-pet', summonOwner: oldPet },
    timeline: createGw2TimelineIndex({ events: history }),
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
  history.push({ type: 'marker', action: 'companion-retired', at: 5, summonOwner: oldPet });
  const newPet = rangerPetCompanionId(runtime);
  assert.notEqual(newPet, oldPet);
  const incoming = { ...context, time: 5, event: { ...context.event, summonOwner: newPet } };
  assert.equal(rangerActiveBoonCount(incoming, 'pet'), 0);
  assert.equal(rangerActiveBoonCount({ ...incoming, runtime: undefined }, 'pet'), 0);
  // Both live and historical query modes end this recipient at the swap boundary.
  assert.equal(rangerActiveBoonCount({ ...context, time: 5 }, 'pet'), 0);
  assert.equal(rangerActiveBoonCount({ ...context, time: 5, runtime: undefined }, 'pet'), 0);
  assert.equal(rangerActiveBoonCount(context, 'pet'), 1);
  assert.equal(rangerActiveBoonCount({ ...context, runtime: undefined }, 'pet'), 1);
  recordBuffApplication(runtime.boons, {
    ...buff('might', { recipients: 'summons', affectsSelf: false, eligibleCompanionIds: [newPet] }),
    at: 5
  });
  assert.equal(rangerActiveBoonCount(incoming, 'pet'), 1);
  assert.equal(rangerActiveBoonCount({ ...context, time: 5 }, 'pet'), 0);
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
    // Bind real owner operations for this focused mechanic fixture.
    config.combat = createMechanicCombatServices(config);
    const event = buff('might', { recipients, eligibleCompanionIds: ['pet'] }, config);
    const runtime = { boons: new Map(), buffs: new Map() };
    // Bind real owner operations for this focused mechanic fixture.
    runtime.combat = createMechanicCombatServices(runtime);
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
