import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildContributionDamageSeries,
  buildPhaseDpsSeries,
  buildPhaseEffectSeries,
  buildRollingDpsSeries,
  buildTimeSeries,
  chartAxisMaximum,
  chartValueAt
} from '#gw2/app/results/charts/time-series-model.js';
import { baseResultSummaryMetrics } from '#gw2/app/results/summary-metrics.js';
import { effectFields } from '#tests/helpers/effect-report.js';

// GW2 results preserve chart projections, result controls, and escaped event-log rendering.
test('shared chart lookup and series cover damage timing and configurable effects', () => {
  assert.equal(chartValueAt([], 10), 0);
  assert.equal(
    chartValueAt(
      [
        { t: 0, v: 1 },
        { t: 100, v: 4 }
      ],
      99
    ),
    1
  );
  assert.equal(
    chartValueAt(
      [
        { t: 0, v: 1 },
        { t: 100, v: 4 }
      ],
      100
    ),
    4
  );

  const series = buildTimeSeries(
    {
      rotationEndTime: 9,
      observationEndTime: 9,
      combatEndTime: 2,
      deathTime: 2,
      dpsStartTime: 0.5,
      ...effectFields(
        [
          {
            type: 'buff',
            at: 0,
            kind: 'power',
            stacks: 2,
            duration: 2,
            resolvedAudience: {
              includesSelf: true,
              includesSummons: false,
              alliedPlayerCount: 0,
              companionIds: [],
              recipientCount: 1
            }
          },
          { type: 'damage', at: 0.5, damage: 100 },
          {
            type: 'condition',
            at: 1,
            condition: 'Burning',
            duration: 2,
            expiresAt: 2,
            naturalExpiresAt: 3,
            stacks: 3,
            damage: 0,
            damageTicks: [
              { at: 1, damage: 50 },
              { at: 2, damage: 250 }
            ]
          }
        ],
        2
      ),
      events: [
        {
          type: 'buff',
          at: 0,
          kind: 'power',
          duration: 2,
          stacks: 2,
          resolvedAudience: {
            includesSelf: true,
            includesSummons: false,
            alliedPlayerCount: 0,
            companionIds: [],
            recipientCount: 1
          }
        }
      ]
    },
    1000,
    {
      effectName: (value) => `Effect <${value}>`
    }
  );

  assert.equal(series.durationMs, 1500);
  assert.equal(series.dps[0].v, 0);
  assert.equal(series.dps[1].v, 150);
  assert.equal(series.dps.at(-1).v, 400 / 1.5);
  assert.equal(series.cumulativeDamage.at(-1).v, 400);
  assert.equal(series.effects['Effect <Burning>'][1].v, 3);
  assert.equal(series.effects['Effect <Burning>'].at(-1).v, 3);
  assert.equal(series.effects['Effect <power>'][0].v, 2);
  assert.deepEqual(series.effectTypes, {
    'Effect <Burning>': 'condition',
    'Effect <power>': 'buff'
  });
});

test('shared DPS charts start their sample grid at the first hit', () => {
  const series = buildTimeSeries({
    rotationEndTime: 2,
    observationEndTime: 2,
    combatEndTime: 2,
    dpsStartTime: 1.156,
    ...effectFields(
      [
        { type: 'damage', at: 1.156, damage: 3567 },
        { type: 'damage', at: 1.32, damage: 916 }
      ],
      2
    )
  });

  assert.equal(series.durationMs, 844);
  assert.deepEqual(series.dps.slice(0, 2), [
    { t: 0, v: 0 },
    { t: 250, v: 4483 / 0.25 }
  ]);
});

// A sorted sweep must preserve inclusive sample boundaries, tick ownership, and the reporting window.
test('DPS samples accumulate unordered hits and ticks without changing reporting metrics', () => {
  const result = {
    rotationEndTime: 9,
    observationEndTime: 9,
    combatEndTime: 2.1,
    dpsStartTime: 1,
    deathTime: 2.1,
    totalDamage: 212,
    dps: 212 / 1.1,
    ...effectFields(
      Object.freeze([
        Object.freeze({ type: 'damage', at: 2, damage: 20 }),
        Object.freeze({
          type: 'condition',
          at: 1,
          condition: 'Bleeding',
          damage: 999,
          damageTicks: Object.freeze([
            Object.freeze({ at: 2.2, damage: 10000 }),
            Object.freeze({ at: 1.5, damage: 30 }),
            Object.freeze({ at: 1.25, damage: 10 }),
            Object.freeze({ at: 2.1, damage: 40 })
          ])
        }),
        Object.freeze({ type: 'damage', at: 1, damage: 100 }),
        Object.freeze({ type: 'damage', at: 1.5, damage: 5 }),
        Object.freeze({ type: 'damage', at: 0.75, damage: 7 })
      ]),
      2.1
    )
  };
  const metrics = baseResultSummaryMetrics(result);
  const series = buildTimeSeries(result, 500);
  assert.deepEqual(series.dps, [
    { t: 0, v: 0 },
    { t: 500, v: 152 / 0.5 },
    { t: 1000, v: 172 },
    { t: 1100, v: 212 / 1.1 }
  ]);
  assert.equal(series.cumulativeDamage.at(-1).v, result.totalDamage);
  assert.equal(series.dps.at(-1).v, result.dps);
  assert.deepEqual(baseResultSummaryMetrics(result), metrics);
});

// Damage attribution follows actual payouts and preserves additivity at off-grid phase boundaries and rolling windows.
test('strike and condition contributions sum to total DPS for full fights and phases', () => {
  const series = buildTimeSeries(
    {
      combatEndTime: 7,
      dpsStartTime: 1,
      resolvedEvents: [
        { type: 'damage', at: 1, damage: 100 },
        { type: 'damage', at: 2.1, damage: 200 },
        { type: 'damage', at: 2.1, damage: 50 },
        { type: 'damage', at: 5, damage: 300 },
        {
          type: 'condition',
          at: 1,
          damage: 9999,
          damageTicks: [
            { at: 2.1, damage: 80 },
            { at: 3, damage: 120 },
            { at: 7, damage: 200 },
            { at: 8, damage: 9999 }
          ]
        }
      ]
    },
    500,
    { includeEffects: false }
  );
  assert.equal(series.damageContributions.strike.at(-1).v, 650);
  assert.equal(series.damageContributions.condition.at(-1).v, 400);
  for (const start of [0, 1100]) {
    const full = start === 0;
    const totalDps = full ? series.dps : buildPhaseDpsSeries(series.cumulativeDamage, start, 6000, 430, 1050);
    const totalDamage = totalDps.map(({ t, v }) => ({ t, v: (v * t) / 1000 }));
    const parts = ['strike', 'condition'].map((kind) =>
      buildContributionDamageSeries(series.damageContributions[kind], totalDps, start, full)
    );
    for (const window of [null, 1000, 5000]) {
      const dps = (points) =>
        window ? buildRollingDpsSeries(points, window) : points.map(({ t, v }) => ({ t, v: t ? v / (t / 1000) : 0 }));
      const total = dps(totalDamage);
      const [strike, condition] = parts.map(dps);
      total.forEach((point, index) => assert.ok(Math.abs(point.v - strike[index].v - condition[index].v) < 1e-8));
    }
  }

  assert.deepEqual(
    buildContributionDamageSeries([], series.dps, 0, true).map((point) => point.v),
    series.dps.map(() => 0)
  );
});

test('phase DPS is recalculated from damage within the selected health range', () => {
  assert.deepEqual(
    buildPhaseDpsSeries(
      [
        { t: 0, v: 0 },
        { t: 1000, v: 100 },
        { t: 2000, v: 300 },
        { t: 3000, v: 600 }
      ],
      1000,
      3000,
      100,
      600
    ),
    [
      { t: 0, v: 0 },
      { t: 1000, v: 200 },
      { t: 2000, v: 250 }
    ]
  );
  assert.deepEqual(buildPhaseDpsSeries([], 1000, 1000, 100, 100), []);
});

test('phase effects are cropped and rebased to the selected health range', () => {
  assert.deepEqual(
    buildPhaseEffectSeries(
      [
        { t: 0, v: 0 },
        { t: 500, v: 1 },
        { t: 1500, v: 2 },
        { t: 2500, v: 0 },
        { t: 3000, v: 3 }
      ],
      1000,
      3000
    ),
    [
      { t: 0, v: 1 },
      { t: 500, v: 2 },
      { t: 1500, v: 0 },
      { t: 2000, v: 3 }
    ]
  );
  assert.deepEqual(buildPhaseEffectSeries([], 1000, 3000), []);
  assert.deepEqual(buildPhaseEffectSeries([{ t: 0, v: 1 }], 1000, 1000), []);
});

// A small damage history checks window expiry and startup normalization without depending on a rotation.
test('rolling DPS uses elapsed startup time and expires damage outside its five-second window', () => {
  const damage = [
    { t: 0, v: 0 },
    { t: 1000, v: 100 },
    { t: 2000, v: 300 },
    { t: 5000, v: 500 },
    { t: 6000, v: 600 },
    { t: 6500, v: 750 },
    { t: 12000, v: 750 }
  ];
  assert.deepEqual(
    buildRollingDpsSeries(damage, 5000).map((point) => point.v),
    [0, 100, 150, 100, 100, 130, 0]
  );
  assert.deepEqual(buildRollingDpsSeries([], 5000), []);
  const phaseDps = buildPhaseDpsSeries(damage, 1000, 6000, 100, 600);
  const phaseDamage = phaseDps.map((point) => ({ t: point.t, v: (point.v * point.t) / 1000 }));
  assert.equal(buildRollingDpsSeries(phaseDamage, 5000).at(-1).v, 100);
  const shortWindowDamage = [
    { t: 0, v: 0 },
    { t: 500, v: 100 },
    { t: 1000, v: 300 },
    { t: 1500, v: 500 },
    { t: 2500, v: 500 }
  ];
  assert.deepEqual(
    buildRollingDpsSeries(shortWindowDamage, 1000).map((point) => point.v),
    [0, 200, 300, 400, 0]
  );
});

// The visible curves set the scale; neither rolling mode nor a previous zoom may impose a fixed DPS ceiling.
test('chart axes fit observed DPS and rescale when a zoom excludes the peak', () => {
  const rolling = [
    { t: 0, v: 0 },
    { t: 1000, v: 72000 },
    { t: 6000, v: 12000 },
    { t: 8000, v: 8000 }
  ];
  assert.equal(chartAxisMaximum(rolling.map((point) => point.v)), 100000);
  const zoomed = buildPhaseEffectSeries(rolling, 6000, 8000);
  assert.equal(chartAxisMaximum(zoomed.map((point) => point.v)), 20000);
  assert.equal(chartAxisMaximum([...zoomed.map((point) => point.v), 42000]), 50000);
  assert.equal(chartAxisMaximum([250000]), 500000);
  assert.equal(chartAxisMaximum([0]), 1);
  // A burst near 125k should occupy most of the chart instead of rounding up to a 200k ceiling.
  assert.equal(chartAxisMaximum([42000, 125000], true), 140000);
  assert.equal(chartAxisMaximum([42000, 12000], true), 45000);
  assert.equal(chartAxisMaximum([0], true), 1);
});
