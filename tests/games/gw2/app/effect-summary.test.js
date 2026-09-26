import assert from 'node:assert/strict';
import test from 'node:test';
import { buildChartSeries } from '#gw2/app/results/model.js';
import { buildBoonGeneration } from '#gw2/app/results/charts/boon-generation.js';
import { chartValueAt } from '#gw2/app/results/charts/time-series-model.js';
import { createGw2ResolverRuntimeState } from '#gw2/platform/resolver/runtime-state.js';
import { invokeRelicHook } from '#gw2/platform/equipment/relics/runtime.js';

const self = {
  includesSelf: true,
  includesSummons: false,
  alliedPlayerCount: 0,
  companionIds: [],
  recipientCount: 1
};
const buff = (kind, at, duration, stacks = 1, extra = {}) => ({
  type: 'buff',
  kind,
  at,
  duration,
  stacks,
  resolvedAudience: self,
  ...extra
});
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

// State windows include an open final shroud, close on exit, and refresh Meltdown without stacking it.
test('Harbinger state uptime uses recorded transitions and clips to the observation window', async () => {
  const { bindHarbingerUi } = await import('#gw2/professions/necromancer/specializations/harbinger/presentation.js');
  const { necromancerCatalog } = await import('#gw2/professions/necromancer/catalog.js');
  const presentations = bindHarbingerUi(necromancerCatalog).effectPresentations();
  const transition = (at, entering) => ({
    type: 'weapon_set',
    at,
    shroudSwap: true,
    sourceId: entering ? 'necromancer.shroud-enter' : 'necromancer.shroud-exit'
  });
  const events = [
    transition(0, true),
    { type: 'buff', at: 2, kind: 'meltdown', stacks: 1, duration: 3, resolvedAudience: self },
    transition(3, false),
    transition(4, true),
    { type: 'buff', at: 4, kind: 'meltdown', stacks: 1, duration: 2, resolvedAudience: self }
  ];
  for (const sampleStep of [50, 1000]) {
    const summaries = buildChartSeries(
      { dpsStartTime: 1, deathTime: 7, rotationEndTime: 10, observationEndTime: 10, combatEndTime: 7, events },
      sampleStep,
      presentations
    ).effectSummaries;
    close(summaries['Harbinger Shroud'].uptime, 5 / 6);
    close(summaries.Meltdown.uptime, 4 / 6);
    close(summaries.Meltdown.averageStacks, 4 / 6);
  }

  assert.deepEqual(
    buildChartSeries(
      { rotationEndTime: 2, observationEndTime: 2, combatEndTime: 2, events: [transition(0, false)] },
      250,
      presentations
    ).effectSummaries,
    {}
  );
});

// Recipient caps apply before averaging, and personal grants/extensions cannot leak into allied state.
test('allied boon state preserves recipient caps, extensions, expiry, and observation origin', () => {
  const series = buildChartSeries(
    {
      rotationEndTime: 10,
      observationEndTime: 10,
      combatEndTime: 10,
      combatStartTime: 0,
      dpsStartTime: 1,
      resolvedEvents: [
        buff('might', -1, 30, 25, { audience: { recipients: 'party' } }),
        buff('might', 0, 2, 30, { audience: { recipients: 'party', maximumRecipients: 3 } }),
        buff('fury', 0, 2, 1, { audience: { recipients: 'party', maximumRecipients: 3 } }),
        buff('fury', 0, 20),
        buff('protection', 0, 20),
        { type: 'boon_extension', at: 1, duration: 2, extensionAudience: 'self' },
        { type: 'boon_extension', at: 1.5, duration: 1, extensionAudience: 'all' },
        buff('stability', 4, 2, 3, {
          resolvedAudience: { ...self, includesSelf: false, alliedPlayerCount: 1, recipientCount: 1 }
        })
      ]
    },
    500
  );
  assert.equal(chartValueAt(series.alliedEffects.Might, 0), 12.5);
  assert.equal(chartValueAt(series.alliedEffects.Might, 1500), 12.5);
  assert.equal(chartValueAt(series.alliedEffects.Might, 2000), 0);
  assert.equal(chartValueAt(series.alliedEffects.Fury, 0), 0.5);
  assert.equal(chartValueAt(series.alliedEffects.Fury, 1500), 0.25);
  assert.equal(chartValueAt(series.alliedEffects.Fury, 2000), 0);
  assert.ok(chartValueAt(series.effects.Fury, 2000) > 0);
  assert.ok(series.alliedEffects.Protection.every((point) => point.v === 0));
  assert.equal(series.effects.Stability, undefined);
  assert.equal(series.effectTypes.Stability, 'boon');
  assert.equal(chartValueAt(series.alliedEffects.Stability, 3000), 0.75);
  assert.equal(chartValueAt(series.alliedEffects.Stability, 5000), 0);
});

// Small synthetic windows exercise integration and supply contracts independently of any benchmark rotation.
test('allied averages integrate capped stacks and duration pools inside the observation window', () => {
  const party = { audience: { recipients: 'party', maximumRecipients: 3 } };
  const result = {
    rotationEndTime: 10,
    observationEndTime: 10,
    combatEndTime: 5,
    combatStartTime: 0,
    dpsStartTime: 1,
    deathTime: 5,
    resolvedEvents: [
      buff('might', 1.12, 0.2, 30, party),
      buff('might', 4.8, 10, 10, { audience: { recipients: 'party' } }),
      buff('fury', 1.12, 0.2, 1, party),
      buff('fury', 1.24, 0.2, 1, party),
      buff('protection', 0, 30)
    ]
  };
  for (const sampleStep of [50, 1000]) {
    const averages = buildChartSeries(result, sampleStep).alliedAverageStacks;
    close(averages.Might, 1.125);
    close(averages.Fury, 0.05);
    assert.equal(averages.Protection, 0);
  }
});

test('duration supply can exceed a full window while caps and gaps reduce actual uptime', () => {
  const result = {
    rotationEndTime: 60,
    observationEndTime: 60,
    combatEndTime: 60,
    resolvedEvents: [buff('quickness', 0, 30), buff('quickness', 0, 30), buff('quickness', 40, 15)]
  };
  for (const sampleStep of [50, 1000]) {
    const summary = buildChartSeries(result, sampleStep).effectSummaries.Quickness;
    assert.equal(summary.uptime, 0.75);
    assert.equal(summary.averageStacks, 0.75);
    assert.equal(summary.generation.generatedStackSeconds, 75);
    assert.equal(summary.generation.generatedStackSeconds / result.rotationEndTime, 1.25);
  }
});

test('intensity averages apply caps and include downtime while generation retains raw stack-seconds', () => {
  const summary = buildChartSeries({
    rotationEndTime: 10,
    observationEndTime: 10,
    combatEndTime: 10,
    resolvedEvents: [buff('might', 0, 5, 20), buff('might', 1, 3, 10)]
  }).effectSummaries.Might;
  assert.equal(summary.uptime, 0.5);
  assert.equal(summary.averageStacks, 11.5);
  assert.equal(summary.maximumStacks, 25);
  assert.equal(summary.maximumStackUptime, 0.3);
  assert.equal(summary.generation.generatedStackSeconds, 130);
});

test('pre-combat boons are stripped and the death boundary excludes later grants', () => {
  const summary = buildChartSeries({
    rotationEndTime: 20,
    observationEndTime: 20,
    combatEndTime: 8,
    dpsStartTime: 2,
    deathTime: 8,
    config: { boons: { quickness: true } },
    resolvedEvents: [
      buff('quickness', 0, 3),
      buff('quickness', 3, 2),
      buff('quickness', 4, 100, 1, { resolvedAudience: { ...self, includesSelf: false, alliedPlayerCount: 1 } }),
      buff('quickness', 5, 100, 1, { actorType: 'environment' }),
      buff('quickness', 6, 100, 1, { cancelled: true }),
      buff('quickness', 8, 100)
    ]
  }).effectSummaries.Quickness;
  assert.equal(summary.uptime, 1 / 3);
  assert.equal(summary.generation.generatedStackSeconds, 2);
});

test('extensions count only existing boons and retain independent intensity lifetimes', () => {
  const events = [
    buff('fury', 0, 1),
    buff('might', 0, 2, 2),
    { type: 'boon_extension', at: 1, duration: 3 },
    buff('fury', 2, 1),
    { type: 'boon_extension', at: 2.5, duration: 2, kind: 'fury' },
    { type: 'boon_extension', at: 4, duration: 1, excludedKind: 'might' }
  ];
  const summaries = buildChartSeries({
    rotationEndTime: 6,
    observationEndTime: 6,
    combatEndTime: 6,
    resolvedEvents: events
  }).effectSummaries;
  close(summaries.Fury.uptime, 5 / 6);
  assert.equal(summaries.Fury.generation.generatedStackSeconds, 5);
  close(summaries.Might.averageStacks, 10 / 6);
  assert.equal(summaries.Might.generation.generatedStackSeconds, 10);
});

test('same-time extension accounting follows causal order and excludes the right window boundary', () => {
  const grant = buff('fury', 0, 1, 1, { causalOrder: 2 });
  const extension = { type: 'boon_extension', at: 0, duration: 3, causalOrder: 1 };
  assert.equal(buildBoonGeneration([grant, extension], 0, 4).boons.get('fury').self.generatedStackSeconds, 1);
  assert.equal(
    buildBoonGeneration([{ ...grant, causalOrder: 0 }, extension, buff('fury', 4, 100)], 0, 4).boons.get('fury').self
      .generatedStackSeconds,
    4
  );
});

test('effect summaries integrate sub-sample transitions and never resurrect replaced effects', () => {
  const summaries = buildChartSeries(
    {
      rotationEndTime: 1,
      observationEndTime: 1,
      combatEndTime: 1,
      resolvedEvents: [buff('first', 0.1, 10), buff('second', 0.3, 0.1)]
    },
    1000,
    [
      { kind: 'first', name: 'First', replacementGroup: 'mode' },
      { kind: 'second', name: 'Second', replacementGroup: 'mode' }
    ]
  ).effectSummaries;
  close(summaries.First.uptime, 0.2);
  close(summaries.Second.uptime, 0.1);
});

test('relic proc state survives recording and refreshes replace stack counts', () => {
  const context = createGw2ResolverRuntimeState({ config: { relic: 'Thief' } });
  const hit = (at) => ({ type: 'damage', actorType: 'player', at, skillName: 'Weapon' });
  invokeRelicHook(context, 'afterHit', hit(0), { type: 'Weapon', cooldown: 1 });
  invokeRelicHook(context, 'afterHit', hit(1), { type: 'Weapon', cooldown: 1 });
  const summary = buildChartSeries({
    rotationEndTime: 8,
    observationEndTime: 8,
    combatEndTime: 8,
    procSteps: context.procSteps
  }).effectSummaries['Relic of the Thief'];
  assert.equal(summary.uptime, 7 / 8);
  assert.equal(summary.averageStacks, 13 / 8);
  assert.equal(summary.maximumStacks, 5);
  assert.equal(summary.maximumStackUptime, 0);

  // A persistent state without an expiry ends at the observation horizon and uses a fresh value on replacement.
  const thorns = createGw2ResolverRuntimeState({ config: { relic: 'Thorns', initialThornsStacks: 9 } });
  invokeRelicHook(thorns, 'passiveTimeline', 5);
  const ramp = buildChartSeries({
    rotationEndTime: 5,
    observationEndTime: 5,
    combatEndTime: 5,
    procSteps: thorns.procSteps
  }).effectSummaries['Relic of Thorns'];
  assert.equal(ramp.uptime, 1);
  assert.equal(ramp.averageStacks, 9.4);
  assert.equal(ramp.maximumStackUptime, 0.4);
});

test('empty observation windows do not accrue uptime or generated duration', () => {
  const summary = buildChartSeries({
    rotationEndTime: 2,
    observationEndTime: 2,
    combatEndTime: 2,
    dpsStartTime: 2,
    resolvedEvents: [buff('might', 2, 10, 25)]
  }).effectSummaries.Might;
  assert.equal(summary.uptime, 0);
  assert.equal(summary.averageStacks, 0);
  assert.equal(summary.generation, undefined);
});

test('combat stripping uses the marker and causal order, retaining boons granted in combat before the first hit', () => {
  const series = buildChartSeries({
    rotationEndTime: 10,
    observationEndTime: 10,
    combatEndTime: 10,
    dpsStartTime: 4,
    combatStartTime: 2,
    events: [{ type: 'combat_start', at: 2, causalOrder: 2 }],
    resolvedEvents: [
      buff('alacrity', 1, 30, 1, { audience: { recipients: 'party' } }),
      buff('quickness', 2, 30, 1, { causalOrder: 1, audience: { recipients: 'party' } }),
      buff('quickness', 2, 5, 1, { causalOrder: 3, audience: { recipients: 'party' } }),
      { type: 'boon_extension', at: 3, duration: 10, kind: 'alacrity', extensionAudience: 'all' },
      buff('fury', 3, 2)
    ],
    procSteps: [{ type: 'relic_proc', skill: 'Relic of Fireworks', start: 0, expiresAt: 8000 }]
  });
  assert.equal(series.effects.Alacrity, undefined);
  assert.equal(series.boonGeneration.Alacrity, undefined);
  assert.equal(series.effectSummaries.Quickness.uptime, 0.5);
  assert.equal(series.boonGeneration.Quickness.self.generatedStackSeconds, 5);
  assert.equal(series.boonGeneration.Quickness.allies.generatedStackSeconds, 20);
  assert.equal(series.effectSummaries.Fury.uptime, 1 / 6);
  assert.equal(series.boonGeneration.Fury.self.generatedStackSeconds, 2);
  assert.equal(series.effectSummaries['Relic of Fireworks'].uptime, 4 / 6);
});

test('personal boons and extensions cannot inflate shared generation, including partial recipient caps', () => {
  const series = buildChartSeries({
    rotationEndTime: 10,
    observationEndTime: 10,
    combatEndTime: 10,
    alliedPlayerCount: 4,
    resolvedEvents: [
      buff('quickness', 0, 5),
      buff('alacrity', 0, 8),
      buff('quickness', 0, 2, 1, { resolvedAudience: { ...self, alliedPlayerCount: 2, recipientCount: 3 } }),
      { type: 'boon_extension', at: 1, duration: 3, extensionAudience: 'self' },
      { type: 'boon_extension', at: 2, duration: 1, extensionAudience: 'all' }
    ]
  });
  const quickness = series.boonGeneration.Quickness;
  assert.equal(series.alliedPlayerCount, 4);
  assert.equal(quickness.self.generatedStackSeconds, 11);
  assert.equal(quickness.selfOnly.generatedStackSeconds, 9);
  assert.equal(quickness.sharedWithSelf.generatedStackSeconds, 2);
  assert.equal(quickness.allies.generatedStackSeconds, 4);
  assert.equal(quickness.allies.generatedStackSeconds / (10 * series.alliedPlayerCount), 0.1);
  assert.equal(series.boonGeneration.Alacrity.allies.generatedStackSeconds, 0);
});

test('allied-only intensity grants extend each reached recipient once and exclude summons', () => {
  const series = buildChartSeries({
    rotationEndTime: 10,
    observationEndTime: 10,
    combatEndTime: 10,
    alliedPlayerCount: 4,
    resolvedEvents: [
      buff('might', 0, 2, 2, {
        resolvedAudience: {
          ...self,
          includesSelf: false,
          alliedPlayerCount: 2,
          includesSummons: true,
          companionIds: ['pet'],
          recipientCount: 3
        }
      }),
      { type: 'boon_extension', at: 1, duration: 3, extensionAudience: 'all' },
      { type: 'boon_extension', at: 2, duration: 1, extensionAudience: 'all' }
    ]
  });
  assert.equal(series.effectSummaries.Might, undefined);
  assert.equal(series.boonGeneration.Might.self.generatedStackSeconds, 0);
  assert.equal(series.boonGeneration.Might.allies.generatedStackSeconds, 24);
});

test('Firebrand tome Quickness remains self-only without configuring allies', async () => {
  const { guardianProfession } = await import('#gw2/professions/guardian/profession.js');
  const { runGw2Runtime } = await import('#gw2/platform/simulation/runtime.js');
  const config = { specialization: 'Firebrand', allies: { count: 0 }, stats: { vitality: 1000 } };
  const result = runGw2Runtime({
    profession: guardianProfession.runtimeFor(config),
    rotation: ['Tome of Justice', { type: 'wait', durationMs: 4000 }],
    config
  });
  assert.deepEqual(result.warnings, []);
  const generation = buildChartSeries(result).boonGeneration.Quickness;
  assert.ok(generation.selfOnly.generatedStackSeconds > 0);
  assert.equal(generation.sharedWithSelf.generatedStackSeconds, 0);
  assert.equal(generation.allies.generatedStackSeconds, 0);
});

test('presentation projects authored audiences onto four allies without mutating resolved combat recipients', () => {
  const events = Object.freeze([
    Object.freeze(buff('quickness', 0, 2, 1, { audience: { recipients: 'party', maximumRecipients: 3 } })),
    Object.freeze(buff('quickness', 1, 1, 1, { audience: { recipients: 'self' } })),
    Object.freeze(buff('alacrity', 0, 3, 1, { audience: { recipients: 'summons', affectsSelf: false } })),
    Object.freeze({ type: 'boon_extension', at: 1.5, duration: 1, extensionAudience: 'all' })
  ]);
  const before = structuredClone(events);
  const generation = buildBoonGeneration(events, 0, 10);
  assert.equal(generation.alliedPlayerCount, 4);
  assert.equal(generation.boons.get('quickness').selfOnly.generatedStackSeconds, 1);
  assert.equal(generation.boons.get('quickness').sharedWithSelf.generatedStackSeconds, 3);
  assert.equal(generation.boons.get('quickness').allies.generatedStackSeconds, 6);
  assert.equal(generation.boons.has('alacrity'), false);
  assert.deepEqual(events, before);
});

test('shared Firebrand generation uses metadata independently of the configured party size', async () => {
  const { guardianProfession } = await import('#gw2/professions/guardian/profession.js');
  const { simulateGw2 } = await import('#gw2/platform/simulation/simulate.js');
  const simulate = (count) =>
    simulateGw2({
      profession: guardianProfession,
      rotation: ['"Feel My Wrath!"', { type: 'wait', durationMs: 4000 }],
      config: {
        specialization: 'Firebrand',
        allies: { count },
        stats: { vitality: 1000 },
        selectedSkills: ['"Feel My Wrath!"']
      }
    });
  const solo = simulate(0);
  const party = simulate(4);
  assert.deepEqual(solo.warnings, []);
  assert.deepEqual(party.warnings, []);
  const soloGeneration = buildChartSeries(solo).boonGeneration.Quickness;
  assert.ok(soloGeneration.allies.generatedStackSeconds > 0);
  assert.deepEqual(soloGeneration, buildChartSeries(party).boonGeneration.Quickness);
  assert.ok(
    solo.resolvedEvents
      .filter((event) => event.kind === 'quickness')
      .every((event) => event.resolvedAudience.alliedPlayerCount === 0)
  );
});
