import { runElementalist } from '#tests/helpers/elementalist-simulation.js';
import { runMesmer } from '#tests/helpers/mesmer-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { runRanger } from '#tests/helpers/ranger-simulation.js';
import { runThief } from '#tests/helpers/thief-simulation.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { recordBuffApplication, remainingDurationStackSeconds } from '#gw2/platform/combat/boons.js';
import {
  applyBoonExtension,
  boonApplicationsAt,
  boonIntervals,
  prepareBoonWindows,
  boonIntervalsFromWindows
} from '#gw2/platform/combat/boons.js';
import { createGw2TimelineIndex } from '#gw2/platform/combat/query/timeline-index.js';
import { buildTimeSeries, chartValueAt } from '#gw2/app/results/charts/time-series-model.js';
import { assertSimulationEvent } from '#gw2/platform/engine/events/events.js';
import { RANGER_TRAIT_IDS } from '#gw2/professions/ranger/data/ids.js';
import { noQuarterCriticalReaction } from '#gw2/professions/thief/core/traits/critical-strikes.js';
import { REVENANT_LEGEND_IDS, REVENANT_SKILL_IDS } from '#gw2/professions/revenant/data/ids.js';
import { runRevenant } from '#tests/helpers/revenant-simulation.js';
import { THIEF_TRAIT_IDS } from '#gw2/professions/thief/data/ids.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';

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

test('prepared boon windows preserve capped pools, extension expiry, recipients, and resource boundaries', () => {
  // A chronological sweep must preserve the same application boundaries even while the boon stays active.
  const events = [
    buff(1, 50, self, 'alacrity'),
    buff(0, 2, self, 'alacrity'),
    { ...buff(2, 5), type: 'boon_extension', kind: 'alacrity' },
    { ...buff(32, 3), type: 'boon_extension', kind: 'alacrity' },
    buff(33, 0.01, self, 'alacrity'),
    { ...buff(0.5, 50, self, 'alacrity'), cancelled: true },
    buff(0, 10, { ...shared, includesSelf: false }, 'alacrity')
  ];
  const windows = prepareBoonWindows(events, 'alacrity', 'all');
  assert.deepEqual(
    [...boonIntervalsFromWindows(windows, -2, 34)],
    [
      { start: -2, end: 0, active: false },
      { start: 0, end: 1, active: true },
      { start: 1, end: 2, active: true },
      { start: 2, end: 32, active: true },
      { start: 32, end: 33, active: false },
      { start: 33, end: 33.04, active: true },
      { start: 33.04, end: 34, active: false }
    ]
  );
  assert.deepEqual([...boonIntervalsFromWindows(windows, 34, Infinity)], [{ start: 34, end: Infinity, active: false }]);
  assert.deepEqual([...boonIntervalsFromWindows(windows, 0.5, 1)], [{ start: 0.5, end: 1, active: true }]);
  assert.deepEqual([...boonIntervalsFromWindows(windows, 2, 1)], []);
  assert.deepEqual(
    [...boonIntervalsFromWindows(prepareBoonWindows([], 'alacrity', 'all'), -1, 1)],
    [{ start: -1, end: 1, active: false }]
  );
  assert.deepEqual(
    [...boonIntervalsFromWindows(prepareBoonWindows(events, 'alacrity', 'summon'), 0, 11)],
    [
      { start: 0, end: 10, active: true },
      { start: 10, end: 11, active: false }
    ]
  );
});

test('prepared windows respect causal order for grants and extensions sharing a timestamp', () => {
  // An earlier extension cannot create a pool; an extension after the grant can lengthen it.
  const grant = { ...buff(0, 2, self, 'alacrity'), eventOrder: 1 };
  const extension = { ...buff(0, 3), type: 'boon_extension', kind: 'alacrity', eventOrder: 2 };
  for (const [eventOrder, expiry] of [
    [0, 2],
    [2, 5]
  ]) {
    assert.deepEqual(
      [...boonIntervalsFromWindows(prepareBoonWindows([{ ...extension, eventOrder }, grant], 'alacrity', 'all'), 0, 6)],
      [
        { start: 0, end: expiry, active: true },
        { start: expiry, end: 6, active: false }
      ]
    );
  }
});

test('permanent self-boon windows bypass event history for integration and readiness', () => {
  // A fixed boon rate must stay independent of the rotation's growing history.
  const events = new Proxy([], { get: () => assert.fail('Permanent boons must not read event history') });
  for (const end of [5, Infinity]) {
    assert.deepEqual([...boonIntervals(events, 'vigor', 2, end, true)], [{ start: 2, end, active: true }]);
  }

  assert.deepEqual([...boonIntervals(events, 'alacrity', 2, 2, true)], []);
});

test('empty and reversed self-boon windows bypass history with or without permanent boons', () => {
  // No resource time elapses, so even a dynamic boon needs no reconstruction.
  const events = new Proxy([], { get: () => assert.fail('Empty windows must not read event history') });
  for (const permanent of [false, true]) {
    for (const [start, end] of [
      [2, 2],
      [2, 1],
      [Infinity, Infinity]
    ]) {
      assert.deepEqual([...boonIntervals(events, 'vigor', start, end, permanent)], []);
    }
  }
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

  const chart = buildTimeSeries(
    { rotationEndTime: 15, observationEndTime: 15, combatEndTime: 15, dpsStartTime: 0, resolvedEvents: events },
    1000,
    {
      durationStackCaps: { fury: 30 }
    }
  );
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
    const simulate = specialization === 'Mirage' ? runMesmer : runElementalist;
    {
      for (const [at, expected] of [
        [3, 22.5],
        [5, 35]
      ]) {
        const result = simulate({
          profession,
          config,
          rotation: [{ type: 'wait', durationMs: at * 1000 }],
          initialize(runtime) {
            runtime.endurance.spend(100);
            runtime.emit(buff(0, 2, self, 'vigor'));
            runtime.emit({ ...buff(1, 2, self, 'vigor'), type: 'boon_extension' });
          }
        });
        assert.equal(
          (specialization === 'Mirage'
            ? observedRuntime(result).profession.specialization.state
            : observedRuntime(result).profession.core
          ).endurance,
          expected
        );
      }
    }
  }
});

test('No Quarter cannot consume Fury authored after its hit at the same timestamp', () => {
  const result = runThief(
    [{ type: 'wait', durationMs: 1000 }],
    {
      specialization: 'Core',
      selectedTraitIds: [THIEF_TRAIT_IDS.NO_QUARTER],
      stats: { precision: 2995 }
    },
    {
      initialize(runtime) {
        runtime.emit({
          ...buff(1),
          type: 'damage',
          coefficient: 1,
          weaponStrength: 1000,
          skillId: 1,
          skillName: 'Probe'
        });
        runtime.emit(buff(1, 5));
      }
    }
  );
  assert.equal(result.resolvedEvents.filter((event) => event.type === 'boon_extension').length, 0);
});

test('forced critical hits preserve the Fury fact needed by No Quarter', () => {
  const result = runThief(
    [{ type: 'wait', durationMs: 3000 }],
    {
      specialization: 'Core',
      selectedTraitIds: [THIEF_TRAIT_IDS.NO_QUARTER]
    },
    {
      initialize(runtime) {
        runtime.emit(buff(0, 2));
        runtime.emit({ ...buff(1), type: 'damage', coefficient: 1, forceCrit: true, weaponStrength: 1000 });
      }
    }
  );
  assert.equal(result.resolvedEvents.filter((event) => event.type === 'boon_extension').length, 1);
  assert.equal(remaining(boonApplicationsAt(result.resolvedEvents, 'fury', 3), 3), 1);
});

// Herald's live consume completes 480 ms after Facet of Nature, so a leading wait lands its extension at `at`.
const HERALD_CONFIG = Object.freeze({
  specialization: 'Herald',
  selectedLegends: [REVENANT_LEGEND_IDS.DRAGON, REVENANT_LEGEND_IDS.ASSASSIN],
  startingLegend: REVENANT_LEGEND_IDS.DRAGON,
  initialEnergy: 100
});
const heraldExtensionAt = (extensionAt, tailMs = 0) => [
  { type: 'wait', durationMs: Math.round(extensionAt * 1000) - 480 },
  'Facet of Nature',
  { skillId: REVENANT_SKILL_IDS.TRUE_NATURE_DRAGON },
  ...(tailMs ? [{ type: 'wait', durationMs: tailMs }] : [])
];

function extend(profession, events, at) {
  if (profession === 'Herald') {
    const result = runRevenant(heraldExtensionAt(at), HERALD_CONFIG, {
      initialize: (runtime) => events.forEach((event) => runtime.emit(event))
    });
    return boonApplicationsAt(result.events, 'fury', at);
  }

  const boons = new Map();
  for (const event of events) recordBuffApplication(boons, event);
  const context = { boons, config: {}, queue: { enqueue() {} } };
  if (profession === 'Thief') {
    // Direct handler calls need the same selected balance source as resolver dispatch.
    noQuarterCriticalReaction.handler(
      { ...context, catalog: thiefProfession.catalog },
      { at, skillName: 'probe' },
      {},
      { quantity: 1 }
    );
  } else {
    applyBoonExtension(boons, { at, duration: 2 });
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

// Herald's live owner and resolver share one runtime: its extension must reach the later hit's critical facts.
for (const enabled of [false, true]) {
  const probe = (at) => ({
    type: 'damage',
    at,
    source: 'probe',
    sourceId: REVENANT_SKILL_IDS.PREPARATION_THRUST,
    actorType: 'player',
    skillId: REVENANT_SKILL_IDS.PREPARATION_THRUST,
    skillName: 'Preparation Thrust',
    coefficient: 1,
    weaponStrengthProfileId: 'weapon.sword',
    activationId: `probe-${at}`
  });
  const result = runRevenant(
    enabled ? heraldExtensionAt(1, 2500) : [{ type: 'wait', durationMs: 3500 }],
    { ...HERALD_CONFIG, stats: { power: 1000, precision: 2470, ferocity: 0, conditionDamage: 0 } },
    {
      initialize(runtime) {
        runtime.emit({ ...buff(0, 2), resolvedAudience: undefined, audience: { recipients: 'self' } });
        runtime.emit(probe(1));
        runtime.emit(probe(3));
      }
    }
  );
  const label = `Herald ${enabled ? 'extension' : 'control'}`;
  check(
    `${label}: resolver observes expected Fury critical chance`,
    result.resolvedEvents.find((event) => event.type === 'damage' && event.activationId === 'probe-3')?.criticalChance,
    enabled ? 1 : 0.75
  );
  check(`${label}: native probe has no warnings`, result.warnings, []);
}

// A live extension changes only later hits; no scheduler prediction participates.
for (const name of ['Thief', 'Ranger'])
  for (const enabled of [false, true]) {
    test(name + ' critical chance follows the live Fury extension: ' + enabled, () => {
      const config = {
        specialization: name === 'Thief' ? 'Deadeye' : 'Soulbeast',
        selectedTraitIds: name === 'Thief' && enabled ? [THIEF_TRAIT_IDS.NO_QUARTER] : [],
        stats: { power: 1000, precision: 2470, ferocity: 0 },
        target: { armor: 2597 }
      };
      const run = name === 'Thief' ? runThief : runRanger;
      const result = run([{ type: 'wait', durationMs: 3500 }], config, {
        initialize(runtime) {
          runtime.emit(buff(0, 2));
          const skill = runtime.helpers.skillsByName.get(name === 'Thief' ? 'Bola Shot' : 'Long Range Shot');
          for (const at of [1, 3])
            runtime.emit({
              type: 'damage',
              at,
              source: 'probe',
              sourceId: skill.id,
              skillId: skill.id,
              skillName: skill.name,
              actorType: 'player',
              coefficient: 1
            });
          if (name === 'Ranger' && enabled) runtime.emit({ ...buff(1, 2), type: 'boon_extension' });
        }
      });
      assert.deepEqual(result.warnings, []);
      assert.equal(
        result.resolvedEvents.find((event) => event.type === 'damage' && event.at === 3).criticalChance,
        enabled ? 1 : 0.75
      );
    });
  }

test('critical boon grants affect later same-time hits exactly once', () => {
  for (const mode of ['deterministic', 'stochastic']) {
    const result = runThief(
      [{ type: 'wait', durationMs: 1000 }],
      {
        specialization: 'Deadeye',
        selectedTraitIds: [
          THIEF_TRAIT_IDS.UNRELENTING_STRIKES,
          THIEF_TRAIT_IDS.NO_QUARTER,
          THIEF_TRAIT_IDS.ASSASSINS_FURY
        ],
        randomness: { mode, seed: 42 },
        stats: { power: 1000, precision: 2470, ferocity: 0 }
      },
      {
        initialize(runtime) {
          const skill = runtime.helpers.skillsByName.get('Bola Shot');
          for (const index of [1, 2, 3])
            runtime.emit({
              type: 'damage',
              at: 1,
              source: 'probe',
              sourceId: skill.id,
              actorType: 'player',
              skillId: skill.id,
              skillName: skill.name,
              coefficient: 1,
              activationId: 'same-' + index
            });
        }
      }
    );
    assert.deepEqual(
      result.resolvedEvents.filter((event) => event.type === 'damage').map((event) => event.criticalChance),
      [0.75, 1, 1]
    );
    const buffs = result.resolvedEvents.filter((event) => event.type === 'buff');
    assert.equal(buffs.filter((event) => event.kind === 'fury').length, 1);
    assert.equal(buffs.filter((event) => event.kind === 'might').length, 1);
    assert.deepEqual(result.warnings, []);
  }
});

test('Essence of Speed extends self Quickness once and ignores ally-only grants', () => {
  for (const includesSelf of [false, true]) {
    const result = runRanger(
      [{ type: 'wait', durationMs: 3000 }],
      {
        specialization: 'Soulbeast',
        selectedTraitIds: [RANGER_TRAIT_IDS.ESSENCE_OF_SPEED]
      },
      {
        initialize(runtime) {
          runtime.emit(buff(0, 2));
          runtime.emit(buff(1, 5, { ...self, includesSelf, alliedPlayerCount: includesSelf ? 0 : 1 }, 'quickness'));
          runtime.emit(buff(1.5, 5, self, 'quickness'));
        }
      }
    );
    assert.equal(remaining(boonApplicationsAt(result.resolvedEvents, 'fury', 3), 3), 1);
    assert.deepEqual(result.warnings, []);
  }
});
