import { StableEventQueue } from '#kernel/events/queue.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { remainingDurationStackSeconds } from '#gw2/platform/combat/boons.js';
import { activeStackCount } from '#gw2/platform/combat/resources/timed-stacks.js';
import { buildChartSeries } from '#gw2/app/results/model.js';
import { chartValueAt } from '#gw2/app/results/charts/time-series-model.js';
import { thiefCoreUi } from '#gw2/professions/thief/core/presentation.js';
import { thiefCatalog } from '#gw2/professions/thief/profession.js';
import { createThiefCoreState } from '#gw2/professions/thief/core/state.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as CORE } from '#gw2/professions/thief/core/profiles.js';
import {
  reactThiefCoreBuff,
  reactThiefCoreCondition,
  reactThiefCoreDamage
} from '#gw2/professions/thief/core/traits/index.js';
import {
  noQuarterCriticalReaction,
  unrelentingStrikesCriticalReaction
} from '#gw2/professions/thief/core/traits/critical-strikes.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { withProfile, withSkill } from '#tests/helpers/catalog-overrides.js';
import { runThief, thiefHit } from '#tests/helpers/thief-simulation.js';

const wait = (durationMs) => ({ type: 'wait', durationMs });

test('Thief critical boons read pre-hit Fury with same-time ordering and expiry', () => {
  // Two same-time hits distinguish the hit granting Fury from the next hit permitted to extend it.
  for (const initialFury of [false, true]) {
    const observed = [];
    const result = runThief(
      [wait(8500)],
      {
        selectedTraitIds: [TRAIT.UNRELENTING_STRIKES, TRAIT.NO_QUARTER],
        stats: { power: 1000, precision: 4000 }
      },
      {
        initialize(runtime) {
          const owner = { source: 'fixture', sourceId: 'strike', actorType: 'player' };
          if (initialFury) runtime.emit({ ...owner, type: 'buff', at: 0, kind: 'fury', stacks: 1, duration: 2 });
          for (const at of [1, 1, initialFury ? 8 : 7]) runtime.emit(thiefHit(at));
        },
        extend: (native) => ({
          reactions: {
            ...native.reactions,
            'damage.resolved'(runtime, event, details) {
              if (event.source === 'fixture') observed.push(details.hitContext.critical.furyActive);
              return native.reactions['damage.resolved'](runtime, event, details);
            }
          }
        })
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(observed, [initialFury, true, false]);
  }
});

const STEAL = thiefCatalog.skillsById.get(ID.STEAL);

/** Repeats an instant action at 1 s, at its internal-cooldown boundary, and just after it. */
function internalCooldownClaims(traitId, action, duration, catalog) {
  const readyAt = [];
  const result = runThief(
    [wait(1000), action, wait(duration * 1000), action, wait(1), action, wait(1)],
    { selectedTraitIds: traitId == null ? [] : [traitId], initialEndurance: 100 },
    {
      catalog: (live) => withProfile(catalog(live), traitId ?? CORE.upperHand, { internalCooldown: duration }),
      initialize(runtime) {
        runtime.profession.core.traitProcReadyAt.unrelated = 99;
      },
      probes: [1.0005, 1 + duration + 0.0005, 1 + duration + 0.0015].map((at) => [
        at,
        (runtime) => readyAt.push({ ...runtime.profession.core.traitProcReadyAt })
      ])
    }
  );
  assert.deepEqual(result.warnings, []);
  return { result, readyAt };
}

// Owner-local claims are scoped to their trait, strict at the boundary, and honor a zero override.
for (const [name, traitId, action, catalog, procs] of [
  [
    'Hidden Thief',
    TRAIT.HIDDEN_THIEF,
    'Steal',
    (live) => withSkill(live, ID.STEAL, { cooldown: 0 }),
    (result) =>
      result.events.filter((event) => event.sourceId === TRAIT.HIDDEN_THIEF && event.condition === 'Blindness').length
  ],
  [
    'Upper Hand',
    TRAIT.UPPER_HAND,
    'Dodge',
    (live) => withProfile(withSkill(live, ID.DODGE, { castTimeMs: 0 }), CORE.resources, { resourceCost: 0 }),
    null
  ]
]) {
  test(`${name} preserves eligibility, scoped claims, strict boundaries and zero overrides`, () => {
    for (const duration of [2, 0]) {
      const unselected = internalCooldownClaims(null, action, duration, catalog);
      for (const claims of unselected.readyAt) assert.deepEqual(claims, { unrelated: 99 });

      const { result, readyAt } = internalCooldownClaims(traitId, action, duration, catalog);
      // The first claim holds through the boundary cast; the strictly later cast claims again.
      assert.equal(readyAt[0][traitId], 1 + duration);
      assert.equal(readyAt[1][traitId], 1 + duration);
      assert.equal(readyAt[2][traitId], 1 + duration + 0.001 + duration);
      for (const claims of readyAt) assert.equal(claims.unrelated, 99);
      if (procs) assert.equal(procs(result), 2);
    }
  });
}

/** Builds the smallest resolver context needed to exercise Core Thief hit, condition, and boon reactions. */
function traitContext(selectedTraitIds = [], config = {}) {
  const fullConfig = { ...config, selectedTraitIds };
  const events = [];
  const conditions = [];
  const core = createThiefCoreState(fullConfig);
  const context = {
    profession: { core, specialization: { kind: 'Core', state: {} } },
    catalog: thiefCatalog,
    config: fullConfig,
    activeWeaponSet: 1,
    queue: new StableEventQueue(),
    boons: new Map(),
    resolved: [],
    time: 1,
    effectiveEnd: 1,
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

// Resolver reactions claim their cooldown before emitting, so synchronous re-entry cannot proc again.
for (const [name, traitId, invoke, output] of [
  [
    'Lotus Poison',
    TRAIT.LOTUS_POISON,
    (c) =>
      reactThiefCoreCondition(c, {
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
    (c) => reactThiefCoreDamage(c, { type: 'damage', at: c.effectiveEnd, actorType: 'player', coefficient: 1 }, {}),
    'applyCondition'
  ],
  [
    "Assassin's Fury",
    TRAIT.ASSASSINS_FURY,
    (c) =>
      reactThiefCoreBuff(c, {
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

test('Lotus Poison grants self Might and target Weakness only for the player poisoning a target', () => {
  // Ineligible poison sources cannot consume the cooldown before the player's own poison arrives.
  const { context, core } = traitContext([TRAIT.LOTUS_POISON]);
  const poison = { type: 'condition', at: 1, actorType: 'player', condition: 'Poisoned', skillName: 'Poison source' };
  for (const overrides of [{ actorType: 'minion' }, { metadata: { triggeredByAlly: 1 } }, { condition: 'Torment' }]) {
    reactThiefCoreCondition(context, { ...poison, ...overrides });
  }

  assert.deepEqual(core.traitProcReadyAt, {});
  assert.equal(context.queue.length, 0);
  reactThiefCoreCondition(context, poison);
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
  for (const at of [1, 10.999, 11]) reactThiefCoreCondition(context, { ...poison, at });
  assert.equal(context.queue.length, 0);
  reactThiefCoreCondition(context, { ...poison, at: 11.001 });
  assert.equal(context.queue.length, 2);
});

/** A lone committed Steal's trait packets; the steal itself authors none. */
function stealPackets(selectedTraitIds) {
  const result = runThief(['Steal'], { selectedTraitIds });
  assert.deepEqual(result.warnings, []);
  return result.events.filter((event) => ['damage', 'condition', 'buff', 'control'].includes(event.type));
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
    const events = stealPackets([traitId]);
    assert.equal(verify(events), true);
    assert.ok(events.every((event) => event.at === 0));
  });
}

test('Potent Poison adjusts each moved player poison packet', () => {
  const serpent = stealPackets([TRAIT.SERPENTS_TOUCH, TRAIT.POTENT_POISON]);
  assert.equal(serpent.find((event) => event.sourceId === TRAIT.SERPENTS_TOUCH).stacks, 3);

  const ambition = traitContext([TRAIT.DEADLY_AMBITION, TRAIT.POTENT_POISON]);
  reactThiefCoreDamage(
    ambition.context,
    {
      type: 'damage',
      at: 0.2,
      actorType: 'player',
      coefficient: 1,
      skillId: ID.DEATH_BLOSSOM,
      sourceId: ID.DEATH_BLOSSOM,
      skillName: 'Death Blossom',
      activationId: 'dual-test'
    },
    {}
  );
  assert.equal(ambition.conditions.find((event) => event.sourceId === TRAIT.DEADLY_AMBITION).stacks, 2);

  const panic = traitContext([TRAIT.PANIC_STRIKE, TRAIT.POTENT_POISON]);
  reactThiefCoreCondition(panic.context, {
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
  for (const [selectedTraitIds, expected] of [
    [[TRAIT.KLEPTOMANIAC], 2],
    [[], 0]
  ]) {
    const result = runThief(['Steal'], { selectedTraitIds, initialInitiative: 0 });
    assert.deepEqual(result.warnings, []);
    assert.equal(observedRuntime(result).resourceController.value('initiative'), expected);
  }
});

test('Lead Attacks records one stack per initiative spent', () => {
  const result = runThief([wait(1000), "Infiltrator's Strike"], {
    primaryWeapon: 'Sword',
    selectedTraitIds: [TRAIT.LEAD_ATTACKS]
  });
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(observedRuntime(result).profession.core.leadAttackExpirations, [11, 11, 11]);
});

test('Lead Attacks replaces oldest stacks across and at the cap while preserving independent expiry', () => {
  // Four grants cross the cap; a fifth arrives at the cap. Both state and chart must retain the new durations.
  for (const grants of [4, 5]) {
    const rotation = Array.from({ length: grants }, (_, index) => [
      ...(index ? [wait(1000)] : []),
      'Heartseeker'
    ]).flat();
    // An instant four-initiative attack with a pool large enough for every grant isolates the stack cap.
    const result = runThief(
      rotation,
      { selectedTraitIds: [TRAIT.LEAD_ATTACKS], initialInitiative: 30 },
      {
        catalog: (live) =>
          withProfile(withSkill(live, ID.HEARTSEEKER, { castTimeMs: 0, initiativeCost: 4 }), CORE.resources, {
            maximumStacks: 30
          })
      }
    );
    assert.deepEqual(result.warnings, []);
    const expirations = observedRuntime(result).profession.core.leadAttackExpirations;
    assert.deepEqual(
      expirations,
      Array.from({ length: grants }, (_, at) => Array(4).fill(at + 10))
        .flat()
        .slice(-15)
    );
    const series = buildChartSeries(
      {
        rotationEndTime: 14,
        observationEndTime: 14,
        combatEndTime: 14,
        events: result.events
          .filter((event) => event.type === 'buff' && event.kind === 'lead-attacks')
          .map((event) => ({ ...event, resolvedAudience: { includesSelf: true } }))
      },
      1000,
      thiefCoreUi.effectPresentations({ catalog: thiefCatalog })
    );
    assert.equal(chartValueAt(series.effects['Lead Attacks'], (grants - 1) * 1000), 15);
    const expected = grants === 4 ? [12, 8, 4, 0, 0] : [15, 12, 8, 4, 0];
    for (let index = 0; index < expected.length; index += 1) {
      const at = 10 + index;
      assert.equal(activeStackCount(expirations, at), expected[index], `state at ${at}s after ${grants} grants`);
      assert.equal(chartValueAt(series.effects['Lead Attacks'], at * 1000), expected[index]);
    }
  }
});

test('Fluid Strikes snapshots its movement-skill duration', () => {
  const result = runThief([wait(1000), "Infiltrator's Strike"], {
    primaryWeapon: 'Sword',
    selectedTraitIds: [TRAIT.FLUID_STRIKES]
  });
  assert.deepEqual(result.warnings, []);
  assert.equal(result.planningState.profession.fluidStrikesUntil, 6);
});

test('Hard to Catch restores endurance on movement skills', () => {
  for (const [selectedTraitIds, expected] of [
    [[TRAIT.HARD_TO_CATCH], 8],
    [[], 0]
  ]) {
    const result = runThief(["Infiltrator's Strike"], {
      primaryWeapon: 'Sword',
      selectedTraitIds,
      initialEndurance: 0
    });
    assert.deepEqual(result.warnings, []);
    assert.equal(result.planningState.profession.endurance, expected);
  }
});

test('Deadly Ambition applies once on the first hit of each dual attack', () => {
  const { context, conditions } = traitContext([TRAIT.DEADLY_AMBITION]);
  const skill = thiefCatalog.skillsById.get(ID.DEATH_BLOSSOM);
  // Interleaved activations and later hits must not duplicate an activation's poison.
  for (const [activationId, at, coefficient, actorType] of [
    ['first', 0.1, 0, 'player'],
    ['first', 0.1, 1, 'summon'],
    ['first', 0.2, 1, 'player'],
    ['second', 0.3, 1, 'player'],
    ['first', 0.4, 1, 'player']
  ]) {
    reactThiefCoreDamage(
      context,
      {
        type: 'damage',
        at,
        coefficient,
        actorType,
        activationId,
        sourceId: skill.id,
        skillId: skill.id,
        skillName: skill.name
      },
      {}
    );
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
  const reaction = unrelentingStrikesCriticalReaction;
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
  noQuarterCriticalReaction.handler(
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
    [TRAIT.UNRELENTING_STRIKES, unrelentingStrikesCriticalReaction],
    [TRAIT.NO_QUARTER, noQuarterCriticalReaction]
  ]) {
    const { context } = traitContext([id]);
    const profiles = new Map();
    context.catalog = { balanceProfilesById: profiles };
    for (const duration of [2, 3]) {
      profiles.set(id, {
        ...thiefCatalog.balanceProfilesById.get(id),
        effects: [{ type: 'boon', name: 'Fury', boon: 'Fury', duration, stacks: 1 }]
      });
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
    noQuarterCriticalReaction.handler(
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
  reactThiefCoreBuff(context, {
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
  withoutTrait.core.venomChargeBatches[ID.SPIDER_VENOM] = [{ charges: 1, expiresAt: 10 }];
  reactThiefCoreDamage(withoutTrait.context, strike, {});
  assert.equal(withoutTrait.conditions[0].skillId, ID.SPIDER_VENOM);
  assert.equal(withoutTrait.context.queue.length, 0);

  const withTrait = traitContext([TRAIT.LEECHING_VENOMS]);
  withTrait.core.venomChargeBatches[ID.SPIDER_VENOM] = [{ charges: 1, expiresAt: 10 }];
  reactThiefCoreDamage(withTrait.context, strike, {});
  assert.equal(withTrait.conditions[0].skillId, ID.SPIDER_VENOM);
  assert.equal(withTrait.context.queue.dequeue().sourceId, TRAIT.LEECHING_VENOMS);
});

// Exercise the real damage dispatcher so a re-entrant child opportunity sees the armed cooldown.
test('Shadow Siphoning gates eligible stealth attacks and keeps its cooldown through re-entry', () => {
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
      reactThiefCoreDamage(context, event, {});
    context.config.selectedTraitIds = [];
    reactThiefCoreDamage(context, hit, {});
    assert.deepEqual(core.traitProcReadyAt, {});
    assert.equal(context.queue.length, 0);
    context.config.selectedTraitIds = [TRAIT.SHADOW_SIPHONING];
    const enqueue = context.queue.enqueue.bind(context.queue);
    context.queue.enqueue = (event) => {
      assert.equal(core.traitProcReadyAt[TRAIT.SHADOW_SIPHONING], event.at + internalCooldown);
      // A child opportunity sees the armed ICD, and effect actors remain ineligible.
      reactThiefCoreDamage(context, { ...hit, at: event.at }, {});
      reactThiefCoreDamage(context, event, {});
      return enqueue(event);
    };

    reactThiefCoreDamage(context, hit, {});
    assert.equal(context.queue.length, 1);
    const siphon = context.queue.dequeue();
    assert.equal(siphon.sourceId, TRAIT.SHADOW_SIPHONING);
    assert.equal(siphon.canCrit, false);
    assert.equal(siphon.lifeSiphon, true);
    assert.equal(core.traitProcReadyAt[TRAIT.SHADOW_SIPHONING], 1 + internalCooldown);
    reactThiefCoreDamage(context, { ...hit, at: 1 + internalCooldown }, {});
    assert.equal(context.queue.length, 0);
    // Retain the legacy name fallback when no catalog ID matches.
    reactThiefCoreDamage(context, { ...hit, at: 3, skillId: -1 }, {});
    assert.equal(context.queue.length, 1);
  }
});

test('Panic Strike applies immobilize then its poison follow-up', () => {
  const { context, conditions } = traitContext([TRAIT.PANIC_STRIKE]);
  reactThiefCoreDamage(
    context,
    {
      type: 'damage',
      at: 1,
      actorType: 'player',
      coefficient: 1,
      skillName: 'Threshold Strike'
    },
    {}
  );
  assert.equal(conditions[0].condition, 'Immobilized');
  reactThiefCoreCondition(context, conditions[0]);
  assert.equal(context.queue.dequeue().condition, 'Poisoned');
});

test('Cloaked in Shadow siphons from applied Blindness', () => {
  const { context } = traitContext([TRAIT.CLOAKED_IN_SHADOW]);
  reactThiefCoreCondition(context, {
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
  const events = stealPackets(stealTraitCases.map(([, traitId]) => traitId));
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

test('cast completion grants Lead stacks before movement traits and leaves poison to hits', () => {
  const result = runThief(["Infiltrator's Strike"], {
    primaryWeapon: 'Sword',
    initialEndurance: 0,
    selectedTraitIds: [TRAIT.LEAD_ATTACKS, TRAIT.FLUID_STRIKES, TRAIT.HARD_TO_CATCH, TRAIT.DEADLY_AMBITION]
  });
  assert.deepEqual(result.warnings, []);
  const lead = result.events.filter((event) => event.sourceId === TRAIT.LEAD_ATTACKS);
  assert.equal(lead.length, 1);
  assert.equal(lead[0].kind, 'lead-attacks');
  assert.equal(lead[0].duration, 10);
  assert.equal(lead[0].stacks, 3);
  assert.equal(result.planningState.profession.fluidStrikesUntil, 5);
  assert.equal(result.planningState.profession.endurance, 8);
  // Deadly Ambition's poison follows the activation's first landed strike, never the cast itself.
  const strikes = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillId === ID.INFILTRATORS_STRIKE && event.actorType === 'player'
  );
  const poison = result.resolvedEvents.filter((event) => event.sourceId === TRAIT.DEADLY_AMBITION);
  assert.ok(poison.every((event) => strikes.some((strike) => strike.at === event.at)));
});
