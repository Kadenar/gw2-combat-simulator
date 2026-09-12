import assert from 'node:assert/strict';
import test from 'node:test';
import { recordBuffApplication, remainingDurationStackSeconds } from '#gw2/platform/combat/state/boons.js';
import {
  applyBoonExtension,
  boonApplicationsAt,
  selfBoonIntervals
} from '#gw2/platform/combat/state/boon-extensions.js';
import { createGw2TimelineIndex } from '#gw2/platform/combat/query/timeline-index.js';
import { buildChartSeries, chartValueAt } from '#gw2/app/results/charts/time-series-model.js';
import { assertSimulationEvent } from '#gw2/platform/engine/events/events.js';
import { RANGER_TRAIT_IDS } from '#gw2/professions/ranger/data/ids.js';
import { noQuarterCriticalReaction } from '#gw2/professions/thief/core/traits/critical-strikes.js';
import { handleRangerBoonExtension } from '#gw2/professions/ranger/specializations/soulbeast/mechanics/beastmode-effects.js';
import { heraldSchedulerHooks } from '#gw2/professions/revenant/specializations/herald/mechanics/facet-rules.js';
import { REVENANT_SKILL_IDS } from '#gw2/professions/revenant/data/ids.js';
import { THIEF_TRAIT_IDS } from '#gw2/professions/thief/data/ids.js';
import { thiefProfession } from '#gw2/professions/thief/definition.js';
import { revenantProfession } from '#gw2/professions/revenant/definition.js';
import { rangerProfession } from '#gw2/professions/ranger/definition.js';
import { elementalistProfession } from '#gw2/professions/elementalist/definition.js';
import { mesmerProfession } from '#gw2/professions/mesmer/definition.js';
import { createScheduler } from '#gw2/platform/engine/execution/scheduler.js';
import { createGw2SchedulerPolicy } from '#gw2/platform/scheduler/policy.js';
import { resolveGw2Timeline } from '#gw2/platform/resolver/resolve-timeline.js';
import { selectedGw2TraitValues } from '#gw2/platform/combat/query/combat-query.js';

// Exercise real extension handlers and both phases with minimal duration/resource contracts.
const self = {
  includesSelf: true,
  includesSummons: false,
  alliedPlayerCount: 0,
  companionIds: [],
  recipientCount: 1
};
const shared = { ...self, includesSummons: true, companionIds: ['pet'], recipientCount: 2 };
const buff = (at, duration = 5, resolvedAudience = self, kind = 'fury', stacks = 1) => ({
  type: 'buff',
  source: 'probe',
  sourceId: 'probe',
  actorType: 'player',
  at,
  duration,
  kind,
  stacks,
  resolvedAudience
});
const remaining = (applications, at, audience = 'includesSelf') =>
  remainingDurationStackSeconds(applications, at, {
    includes: (application) => application.resolvedAudience[audience],
    maximum: 30
  });
function check(name, actual, expected) {
  test(name, () => assert.deepEqual(actual, expected));
}

test('permanent self-boon windows bypass event history for integration and readiness', () => {
  // A fixed boon rate must stay independent of the rotation's growing history.
  const events = new Proxy([], { get: () => assert.fail('Permanent boons must not read event history') });
  for (const end of [5, Infinity]) {
    assert.deepEqual([...selfBoonIntervals(events, 'vigor', 2, end, true)], [{ start: 2, end, active: true }]);
  }
  assert.deepEqual([...selfBoonIntervals(events, 'alacrity', 2, 2, true)], []);
});

test('extensions preserve past duration and intensity observations across recipients and charts', () => {
  const events = [
    buff(0, 5, shared),
    buff(1, 5, shared),
    buff(0, 5, shared, 'might', 3),
    buff(1, 5, shared, 'might', 2)
  ];
  const runtime = new Map();
  for (const event of events) recordBuffApplication(runtime, event);
  const original = structuredClone(events);
  for (const at of [3, 4]) {
    const extension = { ...buff(at, 2), type: 'boon_extension', kind: undefined };
    events.push(extension);
    applyBoonExtension(runtime, extension);
  }

  events.push(buff(20));
  const timeline = createGw2TimelineIndex({ events });
  assert.deepEqual(events.slice(0, 4), original);
  assert.equal(remaining(runtime.get('fury'), 2), 8);
  assert.equal(remaining(runtime.get('fury'), 7), 7);
  assert.equal(remaining(runtime.get('fury'), 7, 'includesSummons'), 3);
  for (const [at, player, pet] of [
    [2, 5, 5],
    [6, 5, 0],
    [9, 2, 0],
    [10, 0, 0]
  ]) {
    assert.equal(timeline.buffStacksAt('might', at, 0, 25), player);
    assert.equal(timeline.buffStacksAt('might', at, 0, 25, 'summon', 'pet'), pet);
    assert.equal(
      runtime
        .get('might')
        .filter(
          (application) =>
            application.resolvedAudience.includesSelf && application.at <= at && application.expiresAt > at
        )
        .reduce((sum, application) => sum + application.stacks, 0),
      player
    );
  }

  const chart = buildChartSeries({ duration: 15, dpsStartTime: 0, resolvedEvents: events }, 1000, {
    durationStackCaps: { fury: 30 }
  });
  assert.equal(chartValueAt(chart.effects.fury, 2000), 8);
  assert.equal(chartValueAt(chart.effects.fury, 7000), 7);
  assert.equal(chartValueAt(chart.effects.might, 6000), 5);
});

test('all-recipient extensions cannot resurrect an expired self pool or affect an excluded boon', () => {
  const pet = { ...self, includesSelf: false, includesSummons: true, companionIds: ['pet'] };
  const events = [
    buff(0, 2),
    buff(0, 10, pet),
    buff(0, 10, self, 'quickness'),
    { ...buff(3, 2), type: 'boon_extension', kind: undefined, extensionAudience: 'all', excludedKind: 'quickness' }
  ];
  const fury = boonApplicationsAt(events, 'fury', 3);
  assert.equal(remaining(fury, 3), 0);
  assert.equal(remaining(fury, 3, 'includesSummons'), 9);
  assert.equal(remaining(boonApplicationsAt(events, 'quickness', 3), 3), 7);
});

test('extension commands reject invalid durations and recipient scopes', () => {
  for (const patch of [{ duration: Infinity }, { duration: -1 }, { extensionAudience: 'unknown' }]) {
    assert.throws(() => assertSimulationEvent({ ...buff(0, 2), type: 'boon_extension', ...patch }), /Boon extensions/);
  }
});

test('extended Vigor preserves Elementalist and Mirage endurance through the new expiry', () => {
  // Recovery must cross the extension and expiry boundaries without reverting early or retaining Vigor afterward.
  for (const [profession, specialization] of [
    [elementalistProfession, 'Core'],
    [mesmerProfession, 'Mirage']
  ]) {
    const config = { specialization, selectedTraitIds: [], boons: { vigor: false } };
    const scheduler = createScheduler({ profession, config, schedulerPolicy: createGw2SchedulerPolicy(config) });
    const { context } = scheduler;
    const state =
      specialization === 'Mirage' ? context.state.profession.specialization.state : context.state.profession.core;
    state.endurance = 0;
    state.enduranceUpdatedAt = 0;
    context.emit(buff(0, 2, self, 'vigor'));
    context.emit({ ...buff(1, 2, self, 'vigor'), type: 'boon_extension' });
    scheduler.advanceTo(3);
    assert.equal(state.endurance, 22.5, specialization);
    scheduler.advanceTo(5);
    assert.equal(state.endurance, 35, specialization);
  }
});

test('No Quarter cannot consume Fury authored after its hit at the same timestamp', () => {
  const config = { specialization: 'Core', selectedTraitIds: [THIEF_TRAIT_IDS.NO_QUARTER], stats: { precision: 2995 } };
  const scheduler = createScheduler({
    profession: thiefProfession,
    config,
    schedulerPolicy: createGw2SchedulerPolicy(config)
  });
  const { context } = scheduler;
  context.emit({ ...buff(1), type: 'damage', coefficient: 1, skillId: 1, skillName: 'Probe' });
  context.emit(buff(1, 5));
  scheduler.advanceTo(1);
  assert.equal(context.events.filter((event) => event.type === 'boon_extension').length, 0);
  assert.equal(context.state.profession.core.traitProcReadyAt[THIEF_TRAIT_IDS.NO_QUARTER] || 0, 0);
});

test('forced critical hits preserve the Fury fact needed by No Quarter', () => {
  const config = { specialization: 'Core', selectedTraitIds: [THIEF_TRAIT_IDS.NO_QUARTER] };
  const policy = createGw2SchedulerPolicy(config);
  const scheduler = createScheduler({ profession: thiefProfession, config, schedulerPolicy: policy });
  const { context } = scheduler;
  context.emit(buff(0, 2));
  const hit = context.emit({ ...buff(1), type: 'damage', coefficient: 1, forceCrit: true });
  scheduler.advanceTo(1);
  assert.equal(policy.critical(context, hit).furyActive, true);
  assert.equal(context.events.filter((event) => event.type === 'boon_extension').length, 1);
  assert.equal(context.hasBuff('fury', 3), true);
});

function extend(profession, events, at) {
  if (profession === 'Herald') {
    const context = {
      eventsOfType: (type) => events.filter((event) => event.type === type),
      epsilon: 0.0001,
      emitDerived: (_event, extension) => events.push(extension)
    };
    heraldSchedulerHooks.onEventScheduled.handler(context, {
      type: 'proc',
      skillId: REVENANT_SKILL_IDS.TRUE_NATURE_ID_51696,
      procType: 'boon-extension',
      at,
      duration: 2
    });
    return boonApplicationsAt(events, 'fury', at);
  }

  const boons = new Map();
  for (const event of events) recordBuffApplication(boons, event);
  const context = { boons, config: {}, queue: { enqueue() {} } };
  if (profession === 'Thief') {
    noQuarterCriticalReaction.handler(context, { at, skillName: 'probe' }, {}, { quantity: 1 });
  } else {
    handleRangerBoonExtension(context, { at, duration: 2 });
  }

  return boons.get('fury') || [];
}

for (const profession of ['Thief', 'Ranger', 'Herald']) {
  for (const [name, events, at] of [
    ['pool survives raw expiries', [buff(0), buff(1)], 7],
    ['overlapping packets extend once', [buff(0), buff(1)], 2],
    ['multi-stack duration packet extends once', [buff(0, 5, self, 'fury', 3)], 1],
    ['extension near duration cap', [buff(0, 30)], 29],
    ['expired pool stays expired', [buff(0)], 7],
    ['single active packet', [buff(0)], 2],
    ['future packet stays future', [buff(8)], 7]
  ]) {
    const before = remaining(events, at);
    const expected = before > 0 ? Math.min(30, before + 2) : 0;
    check(`${profession}: ${name}`, remaining(extend(profession, events, at), at), expected);
  }

  if (profession !== 'Herald') {
    check(
      `${profession}: self extension leaves summon unchanged`,
      remaining(extend(profession, [buff(0, 5, shared)], 1), 6, 'includesSummons'),
      0
    );
  }
}

// Run real scheduler facts and resolver reactions on the same two-hit stream to expose phase disagreement.
for (const name of ['Thief', 'Ranger', 'Herald']) {
  for (const enabled of [false, true]) {
    const config = {
      specialization: name === 'Thief' ? 'Deadeye' : name === 'Ranger' ? 'Soulbeast' : 'Herald',
      primaryWeapon: name === 'Thief' ? 'Pistol' : name === 'Ranger' ? 'Longbow' : 'Sword',
      selectedTraitIds: name === 'Thief' && enabled ? [THIEF_TRAIT_IDS.NO_QUARTER] : [],
      stats: { power: 1000, precision: 2470, ferocity: 0, conditionDamage: 0 },
      target: { armor: 2597 }
    };
    const scheduler = createScheduler({
      profession: name === 'Thief' ? thiefProfession : name === 'Ranger' ? rangerProfession : revenantProfession,
      config,
      schedulerPolicy: createGw2SchedulerPolicy(config)
    });
    const { context } = scheduler;
    context.schedulerPolicy.requireCriticalFacts();
    const skill = context.catalog.skillsByName.get(
      name === 'Thief' ? 'Bola Shot' : name === 'Ranger' ? 'Long Range Shot' : 'Preparation Thrust'
    );
    if (!skill) throw new Error(`Missing ${name} probe skill`);
    if (name === 'Thief') {
      Object.assign(context.state.profession.specialization.state, { markedTargetId: 'target', markExpiresAt: 10 });
    }

    context.emit({ ...buff(0, 2), resolvedAudience: undefined, audience: { recipients: 'self' } });
    scheduler.advanceTo(0);
    const hit = (at) => ({
      type: 'damage',
      at,
      source: 'probe',
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      coefficient: 1,
      hits: 1,
      activationId: `probe-${at}`
    });
    context.emit(hit(1));
    scheduler.advanceTo(1);
    if (name === 'Herald' && enabled) {
      context.emit({
        type: 'proc',
        at: 1,
        source: 'revenant',
        sourceId: REVENANT_SKILL_IDS.TRUE_NATURE_ID_51696,
        actorType: 'player',
        skillId: REVENANT_SKILL_IDS.TRUE_NATURE_ID_51696,
        procType: 'boon-extension',
        duration: 2
      });
    }

    if (name === 'Ranger' && enabled) {
      context.emit({
        type: 'ranger.boon-extension',
        at: 1,
        source: 'ranger',
        sourceId: 'probe',
        actorType: 'effect',
        duration: 2
      });
    }

    const second = context.emit(hit(3));
    scheduler.advanceTo(3);
    const scheduledChance = context.schedulerPolicy.critical(context, second).chance;
    const scheduled = scheduler.run([]);
    const resolved = resolveGw2Timeline({
      stream: scheduled.stream,
      config,
      profession: context.profession,
      traits: selectedGw2TraitValues(config, context.catalog)
    });
    const resolvedHit = resolved.resolvedEvents.find(
      (event) => event.type === 'damage' && event.activationId === 'probe-3'
    );
    if (!resolvedHit) throw new Error(`Missing ${name} resolved probe hit`);
    const label = `${name} ${enabled ? 'extension' : 'control'}`;
    check(`${label}: resolver observes expected Fury critical chance`, resolvedHit.criticalChance, enabled ? 1 : 0.75);
    check(`${label}: scheduled and resolved critical chance agree`, scheduledChance, resolvedHit.criticalChance);
    if (name === 'Thief')
      check(
        `${label}: Deadeye malice follows resolved critical chance`,
        context.state.profession.specialization.state.malice,
        enabled ? 4 : 3
      );
    check(`${label}: native probe has no warnings`, [...scheduled.warnings, ...resolved.warnings], []);
  }
}

test('critical boon predictions preserve same-time hit facts and are applied once during resolution', () => {
  for (const mode of ['deterministic', 'stochastic']) {
    const config = {
      specialization: 'Deadeye',
      primaryWeapon: 'Pistol',
      selectedTraitIds: [
        THIEF_TRAIT_IDS.UNRELENTING_STRIKES,
        THIEF_TRAIT_IDS.NO_QUARTER,
        THIEF_TRAIT_IDS.ASSASSINS_FURY
      ],
      randomness: { mode, seed: 42 },
      stats: { power: 1000, precision: 2470, ferocity: 0 },
      target: { armor: 2597 }
    };
    const scheduler = createScheduler({
      profession: thiefProfession,
      config,
      schedulerPolicy: createGw2SchedulerPolicy(config)
    });
    const { context } = scheduler;
    const skill = context.catalog.skillsByName.get('Bola Shot');
    const hits = [1, 2, 3].map((index) =>
      context.emit({
        type: 'damage',
        at: 1,
        source: 'probe',
        sourceId: skill.id,
        actorType: 'player',
        skillId: skill.id,
        skillName: skill.name,
        coefficient: 1,
        hits: 1,
        activationId: `same-${index}`
      })
    );
    scheduler.advanceTo(1);
    const scheduledChances = hits.map((hit) => context.schedulerPolicy.critical(context, hit).chance);
    const result = resolveGw2Timeline({
      stream: scheduler.run([]).stream,
      config,
      profession: context.profession,
      traits: selectedGw2TraitValues(config, context.catalog)
    });
    const resolvedChances = hits.map(
      (hit) =>
        result.resolvedEvents.find((event) => event.type === 'damage' && event.activationId === hit.activationId)
          .criticalChance
    );
    assert.deepEqual(scheduledChances, resolvedChances, mode);
    if (mode === 'deterministic') assert.deepEqual(resolvedChances, [0.75, 0.75, 1]);
    assert.ok(result.events.every((event) => event.schedulerBoonPrediction !== true));
    const buffs = result.resolvedEvents.filter((event) => event.type === 'buff');
    // Unrelenting Strikes grants Fury once; its gain triggers Might once, while No Quarter only extends.
    assert.equal(buffs.filter((event) => event.kind === 'fury').length, 1);
    assert.equal(buffs.filter((event) => event.kind === 'might').length, 1);
    assert.deepEqual(result.warnings, []);
  }
});

test('Essence of Speed predicts self Quickness extensions without duplicating them or using ally-only grants', () => {
  for (const includesSelf of [false, true]) {
    const config = {
      specialization: 'Soulbeast',
      primaryWeapon: 'Longbow',
      selectedTraitIds: [RANGER_TRAIT_IDS.ESSENCE_OF_SPEED],
      stats: { power: 1000, precision: 2470, ferocity: 0 },
      target: { armor: 2597 }
    };
    const scheduler = createScheduler({
      profession: rangerProfession,
      config,
      schedulerPolicy: createGw2SchedulerPolicy(config)
    });
    const { context } = scheduler;
    context.schedulerPolicy.requireCriticalFacts();
    context.emit(buff(0, 2));
    context.emit(buff(1, 5, { ...self, includesSelf, alliedPlayerCount: includesSelf ? 0 : 1 }, 'quickness'));
    context.emit(buff(1.5, 5, self, 'quickness'));
    // The second grant is on cooldown only when the first one actually affected the player.
    scheduler.advanceTo(3);
    assert.equal(context.hasBuff('fury', 3), true);
    assert.equal(remaining(boonApplicationsAt(context.events, 'fury', 3), 3), 1);
    const result = resolveGw2Timeline({
      stream: scheduler.run([]).stream,
      config,
      profession: context.profession,
      traits: selectedGw2TraitValues(config, context.catalog)
    });
    assert.equal(remaining(boonApplicationsAt(result.resolvedEvents, 'fury', 3), 3), 1);
    assert.deepEqual(result.warnings, []);
  }
});
