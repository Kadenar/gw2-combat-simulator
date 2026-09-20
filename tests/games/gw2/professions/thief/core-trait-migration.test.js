import { StableEventQueue } from '#kernel/events/queue.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { remainingDurationStackSeconds } from '#gw2/platform/combat/boons.js';
import { buildChartSeries } from '#gw2/app/results/model.js';
import { chartValueAt } from '#gw2/app/results/charts/time-series-model.js';
import { advanceThiefCoreResources } from '#gw2/professions/thief/core/mechanics/resources.js';
import { thiefCoreUi } from '#gw2/professions/thief/core/presentation.js';
import { handleThiefState, snapshotThiefState } from '#gw2/professions/thief/family-state.js';
import { completeThiefDodge } from '#gw2/professions/thief/core/execution/dodge.js';

import { thiefCatalog } from '#gw2/professions/thief/profession.js';
import { createThiefCoreState } from '#gw2/professions/thief/core/state.js';
import {
  applyStealCompletionTraits,
  emitStealTraitEffects,
  reactToThiefCoreBuff,
  reactToThiefCoreCondition,
  reactToThiefCoreDamage,
  thiefCoreCriticalReactions,
  updateThiefTraitCastState
} from '#gw2/professions/thief/core/traits/index.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { defineProfession } from '#gw2/platform/engine/profession/contract.js';
import { createScheduler } from '#gw2/platform/engine/execution/scheduler.js';
import { createGw2SchedulerPolicy } from '#gw2/platform/scheduler/policy.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { onResolvedCriticalHit } from '#gw2/platform/profession-definition/mechanics.js';
import {
  observeThiefCriticalBoons,
  materializeThiefCriticalBoons
} from '#gw2/professions/thief/core/traits/critical-strikes.js';

test('Thief boon predictions and resolution share pre-hit Fury, same-time ordering, and expiry', () => {
  // Two same-time hits distinguish the hit granting Fury from the next hit permitted to extend it.
  for (const initialFury of [false, true]) {
    const observed = [];
    const reactions = Object.values(thiefCoreCriticalReactions)
      .filter((reaction) => ['thief.unrelenting-strikes', 'thief.no-quarter'].includes(reaction.id))
      .map(onResolvedCriticalHit);
    const profession = defineProfession({
      id: 'thief-boon-parity',
      name: 'Thief boon parity',
      catalog: thiefCatalog,
      resources: { createProfessionState: (config) => ({ core: createThiefCoreState(config) }) },
      schedulerHooks: {
        initialize(context) {
          context.schedulerPolicy.requireCriticalFacts();
          const owner = { source: 'fixture', sourceId: 'strike', actorType: 'player' };
          if (initialFury) context.emit({ ...owner, type: 'buff', at: 0, kind: 'fury', stacks: 1, duration: 2 });
          for (const at of [1, 1, initialFury ? 8 : 7])
            context.emit({ ...owner, type: 'damage', at, coefficient: 1, weaponStrength: 1000 });
        },
        onEventScheduled: observeThiefCriticalBoons,
        taskHandlers: { 'thief.critical-boons': materializeThiefCriticalBoons }
      },
      resolverHooks: {
        eventReactions: {
          'damage.resolved': (context, event, details) => {
            observed.push(details.hitContext.critical.furyActive);
            for (const reaction of reactions) reaction.handler(context, event, details);
          }
        }
      }
    });
    const config = {
      selectedTraitIds: [TRAIT.UNRELENTING_STRIKES, TRAIT.NO_QUARTER],
      stats: { power: 1000, precision: 4000 }
    };
    const rotation = [{ type: 'wait', durationMs: 8500 }];
    const scheduled = createScheduler({ profession, config, schedulerPolicy: createGw2SchedulerPolicy(config) }).run(
      rotation
    );
    const result = simulateGw2({ profession, config, rotation });
    assert.deepEqual(observed, [initialFury, true, false]);
    for (const traitId of config.selectedTraitIds) {
      assert.equal(
        scheduled.state.profession.core.traitProcReadyAt[traitId],
        result.combatState.profession.core.traitProcReadyAt[traitId]
      );
      assert.equal(
        scheduled.state.profession.core.traitProcProgress[traitId],
        result.combatState.profession.core.traitProcProgress[traitId]
      );
    }
  }
});

const STEAL = thiefCatalog.skillsById.get(ID.STEAL);

test('Hidden Thief checkpoints stay detached and preserve resolver-owned proc deadlines', () => {
  // Scheduler claims must not overwrite the resolver map when a later checkpoint arrives.
  const scheduler = traitContext([TRAIT.HIDDEN_THIEF]);
  emitStealTraitEffects(scheduler.context);
  const snapshot = snapshotThiefState(scheduler.context.state.profession);
  const resolver = traitContext([TRAIT.SHADOW_SIPHONING]);
  Object.assign(resolver.context.profession, resolver.context.state.profession);
  resolver.core.traitProcReadyAt[TRAIT.SHADOW_SIPHONING] = 10;
  handleThiefState(resolver.context, { at: 1, state: snapshot });
  assert.deepEqual(resolver.core.traitProcReadyAt, { [TRAIT.SHADOW_SIPHONING]: 10 });
  scheduler.context.effectiveEnd = 4;
  emitStealTraitEffects(scheduler.context);
  assert.equal(scheduler.core.traitProcReadyAt[TRAIT.HIDDEN_THIEF], 6);
  assert.equal(snapshot.traitProcReadyAt[TRAIT.HIDDEN_THIEF], 3);
});

// Exercise owner-local claims through their real dispatchers, including synchronous re-entry.
for (const [name, traitId, invoke, output] of [
  ['Hidden Thief', TRAIT.HIDDEN_THIEF, (c) => emitStealTraitEffects(c), 'emit'],
  ['Upper Hand', TRAIT.UPPER_HAND, (c) => completeThiefDodge(c), 'emit'],
  [
    'Lotus Poison',
    TRAIT.LOTUS_POISON,
    (c) =>
      reactToThiefCoreCondition(c, {
        type: 'condition',
        at: c.effectiveEnd,
        actorType: 'player',
        condition: 'Poisoned'
      }),
    'queue'
  ],
  [
    'Panic Strike',
    TRAIT.PANIC_STRIKE,
    (c) => reactToThiefCoreDamage(c, { type: 'damage', at: c.effectiveEnd, actorType: 'player', coefficient: 1 }),
    'applyCondition'
  ],
  [
    "Assassin's Fury",
    TRAIT.ASSASSINS_FURY,
    (c) =>
      reactToThiefCoreBuff(c, {
        type: 'buff',
        at: c.effectiveEnd,
        kind: 'fury',
        resolvedAudience: { includesSelf: true }
      }),
    'queue'
  ]
]) {
  test(`${name} preserves eligibility, scoped claims, strict boundaries and zero overrides`, () => {
    for (const duration of [2, 0]) {
      const { context, core } = traitContext([]);
      const profiles = new Map(thiefCatalog.balanceProfilesById);
      profiles.set(traitId, { ...profiles.get(traitId), internalCooldown: duration });
      context.catalog = { ...thiefCatalog, balanceProfilesById: profiles };
      core.traitProcReadyAt.unrelated = 99;
      invoke(context);
      assert.deepEqual(core.traitProcReadyAt, { unrelated: 99 });
      context.config.selectedTraitIds = [traitId];
      const owner = output === 'queue' ? context.queue : context;
      const method = output === 'queue' ? 'enqueue' : output;
      const original = owner[method].bind(owner);
      let emissions = 0;
      let reenter = true;
      owner[method] = (event) => {
        assert.equal(core.traitProcReadyAt[traitId], context.effectiveEnd + duration);
        emissions += 1;
        if (reenter) {
          reenter = false;
          const before = emissions;
          invoke(context);
          assert.equal(emissions, before);
        }

        return original(event);
      };

      invoke(context);
      assert.ok(emissions > 0);
      const firstEmissions = emissions;
      for (const at of [1 + duration, 1 + duration + 0.0000004]) {
        context.effectiveEnd = at;
        invoke(context);
        assert.equal(emissions, firstEmissions);
      }

      context.effectiveEnd = 1 + duration + 0.000001;
      invoke(context);
      assert.ok(emissions > firstEmissions);
      assert.equal(core.traitProcReadyAt.unrelated, 99);
      assert.deepEqual(traitContext([traitId]).core.traitProcReadyAt, {});
    }
  });
}

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
    queue: new StableEventQueue(),
    boons: new Map(),
    resolved: [],
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

test('Lotus Poison grants self Might and target Weakness only for the player poisoning a target', () => {
  // Ineligible poison sources cannot consume the cooldown before the player's own poison arrives.
  const { context, core } = traitContext([TRAIT.LOTUS_POISON]);
  const poison = { type: 'condition', at: 1, actorType: 'player', condition: 'Poisoned', skillName: 'Poison source' };
  for (const overrides of [{ actorType: 'minion' }, { metadata: { triggeredByAlly: 1 } }, { condition: 'Torment' }]) {
    reactToThiefCoreCondition(context, { ...poison, ...overrides });
  }

  assert.deepEqual(core.traitProcReadyAt, {});
  assert.equal(context.queue.length, 0);
  reactToThiefCoreCondition(context, poison);
  const might = context.queue.dequeue();
  const weakness = context.queue.dequeue();
  assert.equal(might.kind, 'might');
  assert.equal(might.stacks, 3);
  assert.equal(might.duration, 10);
  assert.deepEqual(might.audience, { recipients: 'self' });
  assert.equal(weakness.condition, 'Weakness');
  assert.equal(weakness.duration, 4);
  assert.equal(weakness.sourceId, TRAIT.LOTUS_POISON);
  assert.equal(core.traitProcReadyAt[TRAIT.LOTUS_POISON], 11);
  for (const at of [1, 10.999, 11]) reactToThiefCoreCondition(context, { ...poison, at });
  assert.equal(context.queue.length, 0);
  reactToThiefCoreCondition(context, { ...poison, at: 11.001 });
  assert.equal(context.queue.length, 2);
});

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
  reactToThiefCoreDamage(ambition.context, {
    type: 'damage',
    at: 0.2,
    actorType: 'player',
    coefficient: 1,
    skillId: ID.DEATH_BLOSSOM,
    sourceId: ID.DEATH_BLOSSOM,
    skillName: 'Death Blossom',
    activationId: 'dual-test'
  });
  assert.equal(ambition.conditions.find((event) => event.sourceId === TRAIT.DEADLY_AMBITION).stacks, 2);

  const panic = traitContext([TRAIT.PANIC_STRIKE, TRAIT.POTENT_POISON]);
  reactToThiefCoreCondition(panic.context, {
    type: 'condition',
    at: 1,
    actorType: 'player',
    condition: 'Immobilized',
    skillName: 'Panic Strike'
  });
  const poison = panic.context.queue.dequeue();
  assert.equal(poison.sourceId, TRAIT.PANIC_STRIKE);
  assert.equal(poison.stacks, 2);
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

test('Lead Attacks replaces oldest stacks across and at the cap while preserving independent expiry', () => {
  // Four grants cross the cap; a fifth arrives at the cap. Both state and chart must retain the new durations.
  for (const grants of [4, 5]) {
    const { context, core, events } = traitContext([TRAIT.LEAD_ATTACKS]);
    const skill = { id: 900002, name: 'Initiative Test', initiativeCost: 4 };
    for (let at = 0; at < grants; at += 1) {
      advanceThiefCoreResources(context, at);
      context.effectiveEnd = at;
      updateThiefTraitCastState(context, skill);
    }

    assert.equal(core.leadAttacksStacks, 15);
    assert.deepEqual(
      core.leadAttackExpirations,
      Array.from({ length: grants }, (_, at) => Array(4).fill(at + 10))
        .flat()
        .slice(-15)
    );
    const series = buildChartSeries(
      {
        rotationEndTime: 14,
        observationEndTime: 14,
        combatEndTime: 14,
        events: events
          .filter((event) => event.type === 'buff')
          .map((event) => ({ ...event, resolvedAudience: { includesSelf: true } }))
      },
      1000,
      thiefCoreUi.effectPresentations(context)
    );
    assert.equal(chartValueAt(series.effects['Lead Attacks'], (grants - 1) * 1000), 15);
    const expected = grants === 4 ? [12, 8, 4, 0, 0] : [15, 12, 8, 4, 0];
    for (let index = 0; index < expected.length; index += 1) {
      const at = 10 + index;
      advanceThiefCoreResources(context, at);
      assert.equal(core.leadAttacksStacks, expected[index], `state at ${at}s after ${grants} grants`);
      assert.equal(chartValueAt(series.effects['Lead Attacks'], at * 1000), expected[index]);
    }
  }
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

test('Deadly Ambition applies once on the first hit of each dual attack', () => {
  const { context, events, conditions } = traitContext([TRAIT.DEADLY_AMBITION]);
  const skill = thiefCatalog.skillsById.get(ID.DEATH_BLOSSOM);
  updateThiefTraitCastState(context, skill);
  assert.equal(events.length, 0);
  // Interleaved activations and later hits must not duplicate an activation's poison.
  for (const [activationId, at, coefficient, actorType] of [
    ['first', 0.1, 0, 'player'],
    ['first', 0.1, 1, 'summon'],
    ['first', 0.2, 1, 'player'],
    ['second', 0.3, 1, 'player'],
    ['first', 0.4, 1, 'player']
  ]) {
    reactToThiefCoreDamage(context, {
      type: 'damage',
      at,
      coefficient,
      actorType,
      activationId,
      sourceId: skill.id,
      skillId: skill.id,
      skillName: skill.name
    });
  }

  assert.deepEqual(
    conditions.map((event) => [event.at, event.skillName, event.triggeredBy]),
    [
      [0.2, 'Deadly Ambition', 'Death Blossom'],
      [0.3, 'Deadly Ambition', 'Death Blossom']
    ]
  );
});

test('Unrelenting Strikes retains its critical threshold reaction', () => {
  const { context } = traitContext([TRAIT.UNRELENTING_STRIKES]);
  const event = { type: 'damage', at: 1, actorType: 'player', coefficient: 1, skillName: 'Critical Test' };
  const reaction = thiefCoreCriticalReactions.unrelentingStrikes;
  assert.equal(reaction.when(context, event, { hitContext: { critEligible: true } }), true);
  reaction.handler(context, event, {}, { quantity: 1 });
  const fury = context.queue.dequeue();
  assert.equal(fury.kind, 'fury');
  assert.equal(fury.audience.recipients, 'party');
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
  // Extension is a new chronological delta; the original application remains unchanged.
  assert.equal(context.boons.get('fury')[0].expiresAt, 5);
  assert.equal(remainingDurationStackSeconds(context.boons.get('fury'), 6, { maximum: 30 }), 1);
  assert.equal(context.queue.dequeue().sourceId, TRAIT.NO_QUARTER);
});

test('Thief critical proc batches reread patched effects and retain live boon scaling', () => {
  // Effects are invocation-local; Unrelenting Strikes still samples concentration separately for each queued boon.
  for (const [id, reaction] of [
    [TRAIT.UNRELENTING_STRIKES, thiefCoreCriticalReactions.unrelentingStrikes],
    [TRAIT.NO_QUARTER, thiefCoreCriticalReactions.noQuarter]
  ]) {
    const { context } = traitContext([id]);
    const profiles = new Map();
    context.catalog = { balanceProfilesById: profiles };
    for (const duration of [2, 3]) {
      profiles.set(id, { effects: [{ type: 'boon', boon: 'Fury', duration, stacks: 1 }] });
      context.boons.set('fury', [{ at: 0, expiresAt: 5, resolvedAudience: { includesSelf: true } }]);
      let statReads = 0;
      context.query.statsAt = () => ({ concentration: 1500 * statReads++ });
      reaction.handler(context, { at: 1, actorType: 'player', skillName: 'Test' }, {}, { quantity: 2 });
      assert.equal(context.queue.dequeue().duration, duration);
      assert.equal(context.queue.dequeue().duration, id === TRAIT.UNRELENTING_STRIKES ? duration * 2 : duration);
      assert.equal(context.queue.length, 0);
      if (id === TRAIT.NO_QUARTER) {
        assert.equal(remainingDurationStackSeconds(context.boons.get('fury'), 1, { maximum: 30 }), 4 + 2 * duration);
      }
    }
  }
});

test("No Quarter follows Fury's exact half-open expiration boundary", () => {
  for (const [at, expectedProcs] of [
    [0.99995, 1],
    [1, 0]
  ]) {
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
      { type: 'damage', at, actorType: 'player', coefficient: 1, skillName: 'Boundary Test' },
      {},
      { quantity: 1 }
    );
    assert.equal(context.boons.get('fury')[0].expiresAt, 1);
    assert.equal(context.queue.length, expectedProcs);
  }
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
  const might = context.queue.dequeue();
  assert.equal(might.kind, 'might');
  assert.equal(might.stacks, 3);
});

test('Spider Venom remains a base effect and Leeching Venoms stays nested after it', () => {
  const strike = { type: 'damage', at: 1, actorType: 'player', coefficient: 1, skillId: 900006, skillName: 'Strike' };
  const withoutTrait = traitContext();
  withoutTrait.core.venomChargeBatches[ID.SPIDER_VENOM] = [{ generation: 1, charges: 1, expiresAt: 10 }];
  reactToThiefCoreDamage(withoutTrait.context, strike);
  assert.equal(withoutTrait.conditions[0].skillId, ID.SPIDER_VENOM);
  assert.equal(withoutTrait.context.queue.length, 0);

  const withTrait = traitContext([TRAIT.LEECHING_VENOMS]);
  withTrait.core.venomChargeBatches[ID.SPIDER_VENOM] = [{ generation: 1, charges: 1, expiresAt: 10 }];
  reactToThiefCoreDamage(withTrait.context, strike);
  assert.equal(withTrait.conditions[0].skillId, ID.SPIDER_VENOM);
  assert.equal(withTrait.context.queue.dequeue().sourceId, TRAIT.LEECHING_VENOMS);
});

// Exercise the real damage dispatcher and snapshot merge so scheduler checkpoints cannot reset the ICD.
test('Shadow Siphoning gates eligible stealth attacks and preserves resolver cooldowns across snapshots', () => {
  const stealthAttack = thiefCatalog.skills.find((skill) => skill.stealthAttack);
  const hit = {
    type: 'damage',
    at: 1,
    actorType: 'player',
    coefficient: 1,
    skillId: stealthAttack.id,
    skillName: stealthAttack.name
  };
  for (const internalCooldown of [1, 0]) {
    const { context, core } = traitContext([TRAIT.SHADOW_SIPHONING]);
    Object.assign(context.profession, context.state.profession);
    const profiles = new Map(thiefCatalog.balanceProfilesById);
    profiles.set(TRAIT.SHADOW_SIPHONING, { ...profiles.get(TRAIT.SHADOW_SIPHONING), internalCooldown });
    context.catalog = { ...thiefCatalog, balanceProfilesById: profiles };
    for (const event of [
      { ...hit, actorType: 'summon' },
      { ...hit, actorType: 'effect' },
      { ...hit, coefficient: 0 },
      { ...hit, skillId: STEAL.id, skillName: stealthAttack.name },
      { ...hit, skillId: -1, skillName: 'Unknown attack' }
    ])
      reactToThiefCoreDamage(context, event);
    context.config.selectedTraitIds = [];
    reactToThiefCoreDamage(context, hit);
    assert.deepEqual(core.traitProcReadyAt, {});
    assert.equal(context.queue.length, 0);
    context.config.selectedTraitIds = [TRAIT.SHADOW_SIPHONING];
    const enqueue = context.queue.enqueue.bind(context.queue);
    context.queue.enqueue = (event) => {
      assert.equal(core.traitProcReadyAt[TRAIT.SHADOW_SIPHONING], event.at + internalCooldown);
      // A child opportunity sees the armed ICD, and effect actors remain ineligible.
      reactToThiefCoreDamage(context, { ...hit, at: event.at });
      reactToThiefCoreDamage(context, event);
      return enqueue(event);
    };

    reactToThiefCoreDamage(context, hit);
    assert.equal(context.queue.length, 1);
    const siphon = context.queue.dequeue();
    assert.equal(siphon.sourceId, TRAIT.SHADOW_SIPHONING);
    assert.equal(siphon.canCrit, false);
    assert.equal(siphon.lifeSiphon, true);
    const snapshot = { traitProcReadyAt: {}, initiative: 7 };
    handleThiefState(context, { at: 1, state: snapshot });
    assert.equal(core.initiative, 7);
    assert.equal(core.traitProcReadyAt[TRAIT.SHADOW_SIPHONING], 1 + internalCooldown);
    assert.deepEqual(snapshot.traitProcReadyAt, {});
    reactToThiefCoreDamage(context, { ...hit, at: 1 + internalCooldown });
    assert.equal(context.queue.length, 0);
    // Retain the legacy name fallback when no catalog ID matches.
    reactToThiefCoreDamage(context, { ...hit, at: 3, skillId: -1 });
    assert.equal(context.queue.length, 1);
  }
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
  assert.equal(context.queue.dequeue().condition, 'Poisoned');
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
  const siphon = context.queue.dequeue();
  assert.equal(siphon.sourceId, TRAIT.CLOAKED_IN_SHADOW);
  assert.equal(siphon.lifeSiphon, true);
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

test('cast-state updates publish Lead stacks before movement traits and leave poison to hits', () => {
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
    [TRAIT.LEAD_ATTACKS, 'thief.state.lead-attacks', 'thief.state.hard-to-catch']
  );
  assert.equal(events[0].kind, 'lead-attacks');
  assert.equal(events[0].duration, 10);
  assert.equal(events[0].stacks, 1);
  assert.equal(events[2].state.fluidStrikesUntil, 6);
});
