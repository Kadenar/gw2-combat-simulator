import { baseAttributeInputs } from '#gw2/platform/builds/attribute-inputs.js';
import { timedEffectState } from '#gw2/platform/combat/effect-state.js';
import { effectFields } from '#tests/helpers/effect-report.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import { recordProcStep } from '#gw2/platform/results/proc-steps.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildChartSeries } from '#gw2/app/results/model.js';
import { buildBoonGeneration } from '#gw2/platform/results/boon-generation.js';
import { chartValueAt } from '#gw2/app/results/charts/time-series-model.js';
import { createGw2ResolverRuntimeState } from '#gw2/platform/resolver/runtime-state.js';
import { invokeRelicHook } from '#gw2/platform/equipment/relics/runtime.js';
import { EffectRecorder } from '#gw2/platform/results/effect-report.js';

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

// Repeated grants must use combat's caps and refresh semantics throughout the observation window.
test('Bladesworn charts cap intensity and replace complete Glory duration windows', async () => {
  const { warriorProfession } = await import('#gw2/professions/warrior/profession.js');
  const { warriorCatalog } = await import('#gw2/professions/warrior/catalog.js');
  const presentations = warriorProfession.ui.effectPresentations({
    specialization: 'Bladesworn',
    catalog: warriorCatalog
  });
  const result = {
    combatEndTime: 20,
    dpsStartTime: 2,
    ...effectFields([buff('fierce-as-fire', 0, 15, 8), buff('fierce-as-fire', 2, 15, 5)], 20, {
      policies: [{ kind: 'fierce-as-fire', maximumStacks: 10 }],
      frames: [
        {
          at: 0,
          states: [
            timedEffectState('guns-and-glory', [{ stacks: 1, expiresAt: 3 }], 1, {
              measure: 'remaining-duration',
              durationLimit: 12
            })
          ]
        },
        {
          at: 1,
          states: [
            timedEffectState('guns-and-glory', [{ stacks: 1, expiresAt: 6 }], 1, {
              measure: 'remaining-duration',
              durationLimit: 12
            })
          ]
        },
        {
          at: 2,
          states: [
            timedEffectState('guns-and-glory', [{ stacks: 1, expiresAt: 14 }], 1, {
              measure: 'remaining-duration',
              durationLimit: 12
            })
          ]
        }
      ]
    })
  };
  for (const sampleStep of [50, 1000]) {
    const series = buildChartSeries(result, sampleStep, presentations);
    const fire = series.effectSummaries['Fierce as Fire'];
    assert.equal(fire.maximumStacks, 10);
    close(fire.averageStacks, (13 * 10 + 2 * 5) / 18);
    assert.equal(chartValueAt(series.effects['Fierce as Fire'], 0), 10);
    assert.equal(chartValueAt(series.effects['Fierce as Fire'], 13000), 5);
    assert.equal(series.effectUnits['Guns and Glory'], 's');
    assert.equal(chartValueAt(series.effects['Guns and Glory'], 0), 12);
    assert.equal(chartValueAt(series.effects['Guns and Glory'], 1000), 11);
    assert.equal(chartValueAt(series.effects['Guns and Glory'], 12000), 0);
    close(series.effectSummaries['Guns and Glory'].averageStacks, 12 / 18);
    close(series.effectSummaries['Guns and Glory'].uptime, 12 / 18);
  }
});

test('duration snapshots honor patched caps and never resurrect a replaced window', () => {
  const series = buildChartSeries(
    {
      combatEndTime: 10,
      ...effectFields([], 10, {
        frames: [
          {
            at: 0,
            states: [
              timedEffectState('window', [{ stacks: 1, expiresAt: 3 }], 1, {
                measure: 'remaining-duration',
                durationLimit: 3
              })
            ]
          },
          {
            at: 1,
            states: [
              timedEffectState('window', [{ stacks: 1, expiresAt: 2 }], 1, {
                measure: 'remaining-duration',
                durationLimit: 3
              })
            ]
          },
          {
            at: 5,
            states: [
              timedEffectState('window', [{ stacks: 1, expiresAt: 8 }], 1, {
                measure: 'remaining-duration',
                durationLimit: 3
              })
            ]
          }
        ]
      })
    },
    1000,
    [{ id: 'window', kind: 'window', name: 'Window' }]
  );
  assert.deepEqual(
    series.effects.Window.map(({ v }) => v),
    [3, 1, 0, 0, 0, 3, 2, 1, 0, 0, 0]
  );
  assert.equal(series.effectSummaries.Window.averageStacks, 0.5);
});

// State windows include an open final shroud, close on exit, and refresh Meltdown without stacking it.
test('Harbinger state uptime uses recorded transitions and clips to the observation window', async () => {
  const { bindHarbingerUi } = await import('#gw2/professions/necromancer/specializations/harbinger/presentation.js');
  const { necromancerCatalog } = await import('#gw2/professions/necromancer/catalog.js');
  const presentations = bindHarbingerUi(necromancerCatalog).effectPresentations();
  const transition = (at, entering) => ({
    type: 'weapon_set',
    at,
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
      {
        dpsStartTime: 1,
        deathTime: 7,
        rotationEndTime: 10,
        observationEndTime: 10,
        combatEndTime: 7,
        ...effectFields(events, 7, {
          policies: [{ kind: 'meltdown', maximumStacks: 1 }],
          frames: [
            { at: 0, states: [timedEffectState('harbinger-shroud', [{ stacks: 1, expiresAt: null }], 1)] },
            { at: 3, states: [] },
            { at: 4, states: [timedEffectState('harbinger-shroud', [{ stacks: 1, expiresAt: null }], 1)] }
          ]
        })
      },
      sampleStep,
      presentations
    ).effectSummaries;
    close(summaries['Harbinger Shroud'].uptime, 5 / 6);
    close(summaries.Meltdown.uptime, 4 / 6);
    close(summaries.Meltdown.averageStacks, 4 / 6);
  }

  assert.deepEqual(
    buildChartSeries(
      { rotationEndTime: 2, observationEndTime: 2, combatEndTime: 2, ...effectFields([transition(0, false)], 2) },
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
      ...effectFields(
        [
          buff('might', 0, 2, 30, { audience: { recipients: 'party', maximumRecipients: 3 } }),
          buff('fury', 0, 2, 1, { audience: { recipients: 'party', maximumRecipients: 3 } }),
          buff('fury', 0, 20),
          buff('protection', 0, 20),
          { type: 'boon_extension', at: 1, duration: 2, extensionAudience: 'self' },
          { type: 'boon_extension', at: 1.5, duration: 1, extensionAudience: 'all' },
          buff('stability', 4, 2, 3, {
            resolvedAudience: { ...self, includesSelf: false, alliedPlayerCount: 1, recipientCount: 1 }
          })
        ],
        10
      )
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
    ...effectFields(
      [
        buff('might', 1.12, 0.2, 30, party),
        buff('might', 4.8, 10, 10, { audience: { recipients: 'party' } }),
        buff('fury', 1.12, 0.2, 1, party),
        buff('fury', 1.24, 0.2, 1, party),
        buff('protection', 0, 30)
      ],
      5
    )
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
    ...effectFields([buff('quickness', 0, 30), buff('quickness', 0, 30), buff('quickness', 40, 15)], 60)
  };
  for (const sampleStep of [50, 1000]) {
    const series = buildChartSeries(result, sampleStep);
    const summary = series.effectSummaries.Quickness;
    assert.equal(summary.uptime, 0.75);
    assert.equal(summary.averageStacks, 0.75);
    assert.equal(series.boonGeneration.Quickness.self.generatedStackSeconds, 75);
    assert.equal(series.boonGeneration.Quickness.self.generatedStackSeconds / result.rotationEndTime, 1.25);
  }
});

test('intensity averages apply caps and include downtime while generation retains raw stack-seconds', () => {
  const series = buildChartSeries({
    rotationEndTime: 10,
    observationEndTime: 10,
    combatEndTime: 10,
    ...effectFields([buff('might', 0, 5, 20), buff('might', 1, 3, 10)], 10)
  });
  const summary = series.effectSummaries.Might;
  assert.equal(summary.uptime, 0.5);
  assert.equal(summary.averageStacks, 11.5);
  assert.equal(summary.maximumStacks, 25);
  assert.equal(summary.maximumStackUptime, 0.3);
  assert.equal(series.boonGeneration.Might.self.generatedStackSeconds, 130);
});

test('engine-granted preparation boons persist and the death boundary excludes later grants', () => {
  const series = buildChartSeries({
    rotationEndTime: 20,
    observationEndTime: 20,
    combatEndTime: 8,
    dpsStartTime: 2,
    deathTime: 8,
    config: { boons: { quickness: true } },
    ...effectFields(
      [
        buff('quickness', 0, 3),
        buff('quickness', 3, 2),
        buff('quickness', 4, 100, 1, { resolvedAudience: { ...self, includesSelf: false, alliedPlayerCount: 1 } }),
        buff('quickness', 5, 100, 1, { actorType: 'environment' }),
        buff('quickness', 6, 100, 1, { cancelled: true }),
        buff('quickness', 8, 100)
      ],
      8,
      { start: 2 }
    )
  });
  const summary = series.effectSummaries.Quickness;
  assert.equal(summary.uptime, 0.5);
  assert.equal(series.boonGeneration.Quickness.self.generatedStackSeconds, 2);
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
  const series = buildChartSeries({
    rotationEndTime: 6,
    observationEndTime: 6,
    combatEndTime: 6,
    ...effectFields(events, 6)
  });
  const summaries = series.effectSummaries;
  close(summaries.Fury.uptime, 5 / 6);
  assert.equal(series.boonGeneration.Fury.self.generatedStackSeconds, 5);
  close(summaries.Might.averageStacks, 10 / 6);
  assert.equal(series.boonGeneration.Might.self.generatedStackSeconds, 10);
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
      ...effectFields([], 1, {
        frames: [
          { at: 0.1, states: [timedEffectState('first', [{ stacks: 1, expiresAt: 10.1 }], 1)] },
          { at: 0.3, states: [timedEffectState('second', [{ stacks: 1, expiresAt: 0.4 }], 1)] }
        ]
      })
    },
    1000,
    [
      { kind: 'first', name: 'First' },
      { kind: 'second', name: 'Second' }
    ]
  ).effectSummaries;
  close(summaries.First.uptime, 0.2);
  close(summaries.Second.uptime, 0.1);
});

test('relic proc state survives recording and refreshes replace stack counts', () => {
  // This reporting fixture composes its observer explicitly, just like the simulation entry point.
  const context = createGw2ResolverRuntimeState({ config: { relic: 'Thief' }, effectRecorder: new EffectRecorder() });
  context.effects = captureEffectEmissions({
    announce: (request) => recordProcStep(context, request.announcement)
  }).effects;
  const hit = (at) => ({ type: 'damage', actorType: 'player', at, skillName: 'Weapon' });
  invokeRelicHook(context, 'afterHit', hit(0), { type: 'Weapon', cooldown: 1 });
  invokeRelicHook(context, 'afterHit', hit(1), { type: 'Weapon', cooldown: 1 });
  const summary = buildChartSeries({
    rotationEndTime: 8,
    observationEndTime: 8,
    combatEndTime: 8,
    ...effectFields([], 8),
    effectReport: context.effectRecorder.finish(8),
    procSteps: context.procSteps
  }).effectSummaries['Relic of the Thief'];
  assert.equal(summary.uptime, 7 / 8);
  assert.equal(summary.averageStacks, 13 / 8);
  assert.equal(summary.maximumStacks, 5);
  assert.equal(summary.maximumStackUptime, 0);

  // A persistent state without an expiry ends at the observation horizon and uses a fresh value on replacement.
  const thorns = createGw2ResolverRuntimeState({
    config: { relic: 'Thorns', initialThornsStacks: 9 },
    effectRecorder: new EffectRecorder()
  });
  thorns.effects = captureEffectEmissions({
    announce: (request) => recordProcStep(thorns, request.announcement)
  }).effects;
  invokeRelicHook(thorns, 'passiveTimeline', 5);
  const ramp = buildChartSeries({
    rotationEndTime: 5,
    observationEndTime: 5,
    combatEndTime: 5,
    ...effectFields([], 5),
    effectReport: thorns.effectRecorder.finish(5),
    procSteps: thorns.procSteps
  }).effectSummaries['Relic of Thorns'];
  assert.equal(ramp.uptime, 1);
  assert.equal(ramp.averageStacks, 9.4);
  assert.equal(ramp.maximumStackUptime, 0.4);
});

test('empty observation windows do not accrue uptime or generated duration', () => {
  const series = buildChartSeries({
    rotationEndTime: 2,
    observationEndTime: 2,
    combatEndTime: 2,
    dpsStartTime: 2,
    ...effectFields([buff('might', 2, 10, 25)], 2)
  });
  const summary = series.effectSummaries.Might;
  assert.equal(summary.uptime, 0);
  assert.equal(summary.averageStacks, 0);
  assert.equal(series.boonGeneration.Might, undefined);
});

// A boon supplied only before combat still has an allied duration curve, with zero combat generation.
test('preparation-only party boons remain visible on both chart audiences', () => {
  const series = buildChartSeries({
    rotationEndTime: 6,
    observationEndTime: 6,
    combatEndTime: 6,
    combatStartTime: 2,
    dpsStartTime: 2,
    ...effectFields([buff('alacrity', 0, 4, 1, { audience: { recipients: 'party' } })], 6, { start: 2 })
  });
  assert.equal(series.boonGeneration.Alacrity.self.generatedStackSeconds, 0);
  assert.equal(series.boonGeneration.Alacrity.allies.generatedStackSeconds, 0);
  for (const at of [0, 1000, 2000, 3000]) {
    assert.equal(chartValueAt(series.alliedEffects.Alacrity, at), chartValueAt(series.effects.Alacrity, at));
  }
});

test('charts retain accepted preparation state while generation uses the combat window', () => {
  const series = buildChartSeries({
    rotationEndTime: 10,
    observationEndTime: 10,
    combatEndTime: 10,
    dpsStartTime: 4,
    combatStartTime: 2,
    events: [{ type: 'combat_start', at: 2, causalOrder: 2 }],
    ...effectFields(
      [
        buff('alacrity', 1, 30, 1, { audience: { recipients: 'party' } }),
        buff('quickness', 2, 30, 1, { causalOrder: 1, audience: { recipients: 'party' } }),
        buff('quickness', 2, 5, 1, { causalOrder: 3, audience: { recipients: 'party' } }),
        { type: 'boon_extension', at: 3, duration: 10, kind: 'alacrity', extensionAudience: 'all' },
        buff('fury', 3, 2)
      ],
      10,
      {
        start: 2,
        frames: [
          {
            at: 0,
            states: [
              timedEffectState('relic:fireworks', [{ stacks: 1, expiresAt: 8 }], 1, { name: 'Relic of Fireworks' })
            ]
          }
        ]
      }
    )
  });
  assert.equal(series.effectSummaries.Alacrity.uptime, 1);
  // The preparation grant earns no combat credit, but the later extension reaches its existing party pools.
  assert.equal(series.boonGeneration.Alacrity.self.generatedStackSeconds, 10);
  assert.equal(series.boonGeneration.Alacrity.allies.generatedStackSeconds, 40);
  assert.equal(series.effectSummaries.Quickness.uptime, 1);
  assert.equal(series.boonGeneration.Quickness.self.generatedStackSeconds, 35);
  assert.equal(series.boonGeneration.Quickness.allies.generatedStackSeconds, 140);
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
    ...effectFields(
      [
        buff('quickness', 0, 5),
        buff('alacrity', 0, 8),
        buff('quickness', 0, 2, 1, { resolvedAudience: { ...self, alliedPlayerCount: 2, recipientCount: 3 } }),
        { type: 'boon_extension', at: 1, duration: 3, extensionAudience: 'self' },
        { type: 'boon_extension', at: 2, duration: 1, extensionAudience: 'all' }
      ],
      10
    )
  });
  const quickness = series.boonGeneration.Quickness;
  assert.equal(series.alliedPlayerCount, 4);
  assert.equal(quickness.self.generatedStackSeconds, 11);
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
    ...effectFields(
      [
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
      ],
      10
    )
  });
  assert.equal(series.effectSummaries.Might, undefined);
  assert.equal(series.boonGeneration.Might.self.generatedStackSeconds, 0);
  assert.equal(series.boonGeneration.Might.allies.generatedStackSeconds, 24);
});

test('Firebrand tome Quickness remains self-only without configuring allies', async () => {
  const { guardianProfession } = await import('#gw2/professions/guardian/profession.js');
  const { runGw2Runtime } = await import('#gw2/platform/simulation/runtime.js');
  const config = {
    specialization: 'Firebrand',
    allies: { count: 0 },
    attributeInputs: baseAttributeInputs({ vitality: 1000 })
  };
  const result = runGw2Runtime({
    profession: guardianProfession.runtimeFor(config),
    rotation: ['Tome of Justice', { type: 'wait', durationMs: 4000 }],
    config
  });
  assert.deepEqual(result.warnings, []);
  const generation = buildChartSeries(result).boonGeneration.Quickness;
  assert.ok(generation.self.generatedStackSeconds > 0);
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
  assert.equal(generation.boons.get('quickness').self.generatedStackSeconds, 4);
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
        attributeInputs: baseAttributeInputs({ vitality: 1000 }),
        selectedSkillIds: [29965]
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
