import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { thiefCatalog } from '#gw2/content/professions/thief/catalog.js';
import { createThiefCoreState } from '#gw2/content/professions/thief/core/state.js';
import {
  applyStealCompletionTraits,
  emitStealTraitEffects,
  reactToThiefCoreBuff,
  reactToThiefCoreCondition,
  reactToThiefCoreDamage,
  thiefCoreCriticalReactions,
  updateThiefTraitCastState
} from '#gw2/content/professions/thief/core/traits/index.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/content/professions/thief/data/ids.js';

const STEAL = thiefCatalog.skillsById.get(ID.STEAL);

/** Builds the smallest shared cast/resolver context needed to exercise Core Thief dispatchers. */
function traitContext(selectedTraitIds = [], config = {}) {
  const fullConfig = { ...config, selectedTraitIds };
  const events = [];
  const conditions = [];
  const core = createThiefCoreState(fullConfig);
  const context = {
    profession: { id: 'thief', catalog: thiefCatalog },
    catalog: thiefCatalog,
    config: fullConfig,
    state: {
      time: 0,
      activeWeaponSet: 1,
      profession: { core, specialization: { kind: 'Core', state: {} } }
    },
    activeWeaponSet: 1,
    events,
    queue: [],
    boons: new Map(),
    resolved: [],
    epsilon: 0.0001,
    start: 0,
    fullEnd: 1,
    effectiveEnd: 1,
    reservationId: 'test-cast',
    skill: STEAL,
    helpers: {
      skillsById: thiefCatalog.skillsById,
      skillsByName: thiefCatalog.skillsByName,
      balanceProfilesById: thiefCatalog.balanceProfilesById
    },
    query: {
      statsAt: () => ({}),
      furyActiveAt: () => true,
      targetHasCondition: () => true
    },
    emit(event) {
      events.push(event);
      return event;
    },
    emitDerived(_cause, event) {
      events.push(event);
      return event;
    },
    applyCondition(event) {
      conditions.push(event);
      return event;
    }
  };

  return { context, core, events, conditions };
}

const stealTraitCases = [
  ["Serpent's Touch", TRAIT.SERPENTS_TOUCH, (events) => events.some((event) => event.condition === 'Poisoned')],
  ['Mug', TRAIT.MUG, (events) => events.some((event) => event.type === 'damage' && event.coefficient === 1.5)],
  ['Even the Odds', TRAIT.EVEN_THE_ODDS, (events) => events.some((event) => event.condition === 'Vulnerability')],
  ['Deadly Ambush', TRAIT.DEADLY_AMBUSH, (events) => events.some((event) => event.condition === 'Bleeding')],
  [
    'Thrill of the Crime',
    TRAIT.THRILL_OF_THE_CRIME,
    (events) => events.filter((event) => event.type === 'buff').length === 3
  ],
  ['Bountiful Theft', TRAIT.BOUNTIFUL_THEFT, (events) => events.some((event) => event.kind === 'Vigor')],
  ['Sleight of Hand', TRAIT.SLEIGHT_OF_HAND, (events) => events.some((event) => event.type === 'control')],
  [
    'Hidden Thief',
    TRAIT.HIDDEN_THIEF,
    (events) =>
      events.some((event) => event.condition === 'Blindness') && events.some((event) => event.condition === 'Weakness')
  ]
];

for (const [name, traitId, verify] of stealTraitCases) {
  test(`${name} keeps its steal behavior`, () => {
    const { context, events } = traitContext([traitId]);
    emitStealTraitEffects(context);
    assert.equal(verify(events), true);
    assert.ok(events.every((event) => event.at === 1));
  });
}

test('Potent Poison adjusts each moved player poison packet', () => {
  const serpent = traitContext([TRAIT.SERPENTS_TOUCH, TRAIT.POTENT_POISON]);
  emitStealTraitEffects(serpent.context);
  assert.equal(serpent.events.find((event) => event.sourceId === TRAIT.SERPENTS_TOUCH).stacks, 3);

  const ambition = traitContext([TRAIT.DEADLY_AMBITION, TRAIT.POTENT_POISON]);
  updateThiefTraitCastState(ambition.context, {
    id: 900001,
    name: 'Dual Test',
    categories: ['DualWield']
  });
  assert.equal(ambition.events.find((event) => event.sourceId === TRAIT.DEADLY_AMBITION).stacks, 2);

  const panic = traitContext([TRAIT.PANIC_STRIKE, TRAIT.POTENT_POISON]);
  reactToThiefCoreCondition(panic.context, {
    type: 'condition',
    at: 1,
    actorType: 'player',
    condition: 'Immobilized',
    skillName: 'Panic Strike'
  });
  assert.equal(panic.context.queue.find((event) => event.sourceId === TRAIT.PANIC_STRIKE).stacks, 2);
});

test('Kleptomaniac restores initiative on steal completion', () => {
  const { context, core, events } = traitContext([TRAIT.KLEPTOMANIAC], { initialInitiative: 0 });
  applyStealCompletionTraits(context, 1);
  assert.equal(core.initiative, 2);
  assert.equal(events[0].reason, 'kleptomaniac');
});

test('Lead Attacks records one stack per initiative spent', () => {
  const { context, core } = traitContext([TRAIT.LEAD_ATTACKS]);
  updateThiefTraitCastState(context, { id: 900002, name: 'Initiative Test', initiativeCost: 3 });
  assert.equal(core.leadAttacksStacks, 3);
  assert.deepEqual(core.leadAttackExpirations, [11, 11, 11]);
});

test('Fluid Strikes snapshots its movement-skill duration', () => {
  const { context, core, events } = traitContext([TRAIT.FLUID_STRIKES]);
  updateThiefTraitCastState(context, { id: 900003, name: 'Movement Test', movementSkill: true });
  assert.equal(core.fluidStrikesUntil, 6);
  assert.equal(events[0].reason, 'fluid-strikes');
});

test('Hard to Catch restores endurance on movement skills', () => {
  const { context, core, events } = traitContext([TRAIT.HARD_TO_CATCH]);
  core.endurance = 0;
  updateThiefTraitCastState(context, { id: 900004, name: 'Movement Test', movementSkill: true });
  assert.equal(core.endurance, 8);
  assert.equal(events[0].reason, 'hard-to-catch');
});

test('Deadly Ambition poisons completed dual-wield attacks', () => {
  const { context, events } = traitContext([TRAIT.DEADLY_AMBITION]);
  updateThiefTraitCastState(context, { id: 900005, name: 'Dual Test', categories: ['DualWield'] });
  assert.equal(events[0].sourceId, TRAIT.DEADLY_AMBITION);
  assert.equal(events[0].condition, 'Poisoned');
});

test('Unrelenting Strikes retains its critical threshold reaction', () => {
  const { context } = traitContext([TRAIT.UNRELENTING_STRIKES]);
  const event = { type: 'damage', at: 1, actorType: 'player', coefficient: 1, skillName: 'Critical Test' };
  const reaction = thiefCoreCriticalReactions.unrelentingStrikes;
  assert.equal(reaction.when(context, event, { hitContext: { critEligible: true } }), true);
  reaction.handler(context, event, {}, { quantity: 1 });
  assert.equal(context.queue[0].kind, 'fury');
  assert.equal(context.queue[0].audience.recipients, 'party');
});

test('No Quarter extends active self Fury for each threshold proc', () => {
  const { context } = traitContext([TRAIT.NO_QUARTER]);
  const fury = {
    at: 0,
    expiresAt: 5,
    resolvedAudience: {
      includesSelf: true,
      includesSummons: false,
      alliedPlayerCount: 0,
      companionIds: [],
      recipientCount: 1
    }
  };
  context.boons.set('fury', [fury]);
  thiefCoreCriticalReactions.noQuarter.handler(
    context,
    { type: 'damage', at: 1, actorType: 'player', coefficient: 1, skillName: 'Critical Test' },
    {},
    { quantity: 1 }
  );
  assert.equal(context.boons.get('fury')[0].expiresAt, 7);
  assert.equal(context.queue[0].sourceId, TRAIT.NO_QUARTER);
});

test('No Quarter uses the shared timeline epsilon at Fury expiration', () => {
  const { context } = traitContext([TRAIT.NO_QUARTER]);
  context.boons.set('fury', [
    {
      at: 0,
      expiresAt: 1,
      resolvedAudience: {
        includesSelf: true,
        includesSummons: false,
        alliedPlayerCount: 0,
        companionIds: [],
        recipientCount: 1
      }
    }
  ]);
  thiefCoreCriticalReactions.noQuarter.handler(
    context,
    { type: 'damage', at: 0.99995, actorType: 'player', coefficient: 1, skillName: 'Boundary Test' },
    {},
    { quantity: 1 }
  );
  assert.equal(context.boons.get('fury')[0].expiresAt, 1);
  assert.equal(context.queue.length, 0);
});

test("Assassin's Fury queues Might from self Fury", () => {
  const { context } = traitContext([TRAIT.ASSASSINS_FURY]);
  reactToThiefCoreBuff(context, {
    type: 'buff',
    at: 1,
    kind: 'fury',
    skillName: 'Fury Test',
    resolvedAudience: {
      includesSelf: true,
      includesSummons: false,
      alliedPlayerCount: 0,
      companionIds: [],
      recipientCount: 1
    }
  });
  assert.equal(context.queue[0].kind, 'might');
  assert.equal(context.queue[0].stacks, 3);
});

test('Spider Venom remains a base effect and Leeching Venoms stays nested after it', () => {
  const strike = { type: 'damage', at: 1, actorType: 'player', coefficient: 1, skillId: 900006, skillName: 'Strike' };
  const withoutTrait = traitContext();
  withoutTrait.core.spiderVenomCharges = 1;
  withoutTrait.core.spiderVenomExpiresAt = 10;
  reactToThiefCoreDamage(withoutTrait.context, strike);
  assert.equal(withoutTrait.conditions[0].skillId, ID.SPIDER_VENOM);
  assert.equal(withoutTrait.context.queue.length, 0);

  const withTrait = traitContext([TRAIT.LEECHING_VENOMS]);
  withTrait.core.spiderVenomCharges = 1;
  withTrait.core.spiderVenomExpiresAt = 10;
  reactToThiefCoreDamage(withTrait.context, strike);
  assert.equal(withTrait.conditions[0].skillId, ID.SPIDER_VENOM);
  assert.equal(withTrait.context.queue[0].sourceId, TRAIT.LEECHING_VENOMS);
});

test('Shadow Siphoning reacts only to cataloged stealth attacks', () => {
  const { context } = traitContext([TRAIT.SHADOW_SIPHONING]);
  const stealthAttack = thiefCatalog.skills.find((skill) => skill.stealthAttack);
  reactToThiefCoreDamage(context, {
    type: 'damage',
    at: 1,
    actorType: 'player',
    coefficient: 1,
    skillId: stealthAttack.id,
    skillName: stealthAttack.name
  });
  assert.equal(context.queue[0].sourceId, TRAIT.SHADOW_SIPHONING);
});

test('Panic Strike applies immobilize then its poison follow-up', () => {
  const { context, conditions } = traitContext([TRAIT.PANIC_STRIKE]);
  reactToThiefCoreDamage(context, {
    type: 'damage',
    at: 1,
    actorType: 'player',
    coefficient: 1,
    skillName: 'Threshold Strike'
  });
  assert.equal(conditions[0].condition, 'Immobilized');
  reactToThiefCoreCondition(context, conditions[0]);
  assert.equal(context.queue[0].condition, 'Poisoned');
});

test('Cloaked in Shadow siphons from applied Blindness', () => {
  const { context } = traitContext([TRAIT.CLOAKED_IN_SHADOW]);
  reactToThiefCoreCondition(context, {
    type: 'condition',
    at: 1,
    actorType: 'player',
    condition: 'Blindness',
    skillName: 'Blind Test'
  });
  assert.equal(context.queue[0].sourceId, TRAIT.CLOAKED_IN_SHADOW);
  assert.equal(context.queue[0].lifeSiphon, true);
});

test('steal activation preserves its cross-line event order', () => {
  const traits = stealTraitCases.map(([, traitId]) => traitId);
  const { context, events } = traitContext(traits);
  emitStealTraitEffects(context);
  assert.deepEqual(
    events.map((event) => event.sourceId),
    [
      TRAIT.SERPENTS_TOUCH,
      TRAIT.MUG,
      TRAIT.EVEN_THE_ODDS,
      TRAIT.DEADLY_AMBUSH,
      'thief.steal.Fury',
      'thief.steal.Might',
      'thief.steal.Swiftness',
      'thief.steal.Vigor',
      'thief.steal.Might',
      TRAIT.SLEIGHT_OF_HAND,
      TRAIT.HIDDEN_THIEF,
      TRAIT.HIDDEN_THIEF
    ]
  );
});

test('cast-state updates preserve Lead, Fluid, Hard to Catch, then Deadly Ambition order', () => {
  const { context, core, events } = traitContext([
    TRAIT.LEAD_ATTACKS,
    TRAIT.FLUID_STRIKES,
    TRAIT.HARD_TO_CATCH,
    TRAIT.DEADLY_AMBITION
  ]);
  core.endurance = 0;
  updateThiefTraitCastState(context, {
    id: 900007,
    name: 'Ordered Cast',
    initiativeCost: 1,
    movementSkill: true,
    categories: ['DualWield']
  });
  assert.deepEqual(
    events.map((event) => event.sourceId),
    ['thief.state.lead-attacks', 'thief.state.hard-to-catch', TRAIT.DEADLY_AMBITION]
  );
  assert.equal(events[1].state.fluidStrikesUntil, 6);
});

test('condition dispatcher preserves Leeching, Panic, Cloaked, then base bonus order', () => {
  const source = readFileSync(
    new URL('../../../js/games/gw2/content/professions/thief/core/traits/index.ts', import.meta.url),
    'utf8'
  );
  const calls = [
    'applyAlliedLeechingVenoms(context, application);',
    'applyPanicStrikePoison(context, application);',
    'applyCloakedInShadow(context, application);',
    'applyUnsuspectingStrikeBonus(context, application);'
  ];
  assert.deepEqual(
    calls.map((call) => source.indexOf(call)),
    [...calls.map((call) => source.indexOf(call))].sort((left, right) => left - right)
  );
});
