import { effectFields } from '#tests/helpers/effect-report.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildTimeSeries,
  buildPhaseDpsSeries,
  buildPhaseEffectSeries,
  buildRollingDpsSeries,
  buildContributionDamageSeries,
  chartAxisMaximum,
  chartValueAt
} from '#gw2/app/results/charts/time-series-model.js';
import { mountTimeSeriesCharts } from '#gw2/app/results/charts/time-series-view.js';
import { mountSimulationSection } from '#ui/results/simulation-view.js';
import { createGw2SimulationViewModel } from '#gw2/app/results/view.js';
import { eventLogCsv, mountEventLog } from '#ui/results/event-log.js';
import { baseResultSummaryMetrics, targetHealthBreakpointSnapshots } from '#gw2/app/results/summary-metrics.js';
import { mountResultSummary, dismissResultMetricDetails } from '#gw2/app/results/summary-view.js';
import { mountRandomDistribution } from '#gw2/app/results/random-distribution-view.js';
import { modifierContributionsHtml, mountModifierContributions } from '#gw2/app/results/modifier-contributions-view.js';
import { mountDamageBreakdown } from '#gw2/app/results/breakdown/view.js';
import { mountResultCharts } from '#gw2/app/results/charts/section-view.js';
import { SKILL_COLS, nextResultSortState, sortResultRows } from '#gw2/app/results/breakdown/model.js';
import { inertContainer } from '#tests/helpers/dom.js';
import { defaultSimulationConfig } from '#tests/helpers/fixture-harness-core.js';
import { simulateMesmer } from '#tests/helpers/mesmer-simulation.js';
import { simulationEventLogRows } from '#gw2/app/results/event-log.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { normalizeProfessionUi } from '#gw2/platform/profession-presentation/contract.js';

// Pending comparisons occupy only their own section and never present old values as current.
test('modifier section shows pending, completed, empty, and failed states', () => {
  const contributions = [{ name: 'Old modifier', dpsIncrease: 12, pctIncrease: 1 }];
  const pending = modifierContributionsHtml({ contributions, contributionsStale: true });
  assert.match(pending, /role="status"/);
  assert.match(pending, /Calculating modifier contributions/);
  assert.doesNotMatch(pending, /Old modifier|contrib-table/);
  assert.match(modifierContributionsHtml({ contributions }), /Old modifier/);
  assert.equal(modifierContributionsHtml({ contributions: [] }), '');
  assert.match(modifierContributionsHtml({ contributionsError: 'Failed <request>' }), /Failed &lt;request&gt;/);
});

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

// Only chart preparation reads a relic's expiry; hidden-view creation must not visit that history.
test('Analysis charts are prepared only when the Analysis view is active', (t) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'document', descriptor);
    else delete globalThis.document;
  });
  const document = {
    body: { dataset: { simulatorView: 'workspace' } },
    defaultView: { location: { hash: '#analysis' } }
  };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: document });
  let chartReads = 0;
  const app = {
    profession: { ui: normalizeProfessionUi('fixture') },
    adapter: { eliteSpecialization: () => 'Core' },
    build: { rotation: [{ type: 'wait', durationMs: 1000 }] },
    results: {
      rotationEndTime: 1,
      observationEndTime: 1,
      combatEndTime: 1,
      totalDamage: 100,
      dps: 100,
      ...effectFields([], 1),
      get effectReport() {
        chartReads++;
        return effectFields([], 1).effectReport;
      }
    }
  };
  for (const view of ['workspace', 'gear-optimizer', 'analysis', 'workspace', 'analysis']) {
    document.body.dataset.simulatorView = view;
    chartReads = 0;
    const model = createGw2SimulationViewModel(app);
    assert.equal(chartReads > 0, view === 'analysis');
    const summary = inertContainer();
    mountSimulationSection(summary, model.summary);
    assert.match(summary.innerHTML, /Player DPS/);
    assert.match(summary.innerHTML, />100</);
  }

  // A direct #analysis load also prepares charts before navigation sets the body dataset.
  delete document.body.dataset.simulatorView;
  chartReads = 0;
  createGw2SimulationViewModel(app);
  assert.ok(chartReads > 0);
});

test('target health breakpoints use cumulative damage and individual condition ticks', () => {
  const snapshots = targetHealthBreakpointSnapshots(
    {
      dpsStartTime: 0.5,
      ...effectFields(
        [
          { type: 'damage', at: 0.5, damage: 100 },
          {
            type: 'condition',
            at: 0.75,
            damage: 350,
            damageTicks: [
              { at: 1, damage: 150 },
              { at: 1.5, damage: 200 }
            ]
          },
          { type: 'damage', at: 1.5, damage: 200 },
          { type: 'damage', at: 2, damage: 200 }
        ],
        120
      )
    },
    1000
  );

  assert.deepEqual(
    snapshots.map((snapshot) => snapshot.healthPercent),
    [80, 60, 40, 20]
  );
  assert.deepEqual(
    snapshots.map((snapshot) => snapshot.elapsed),
    [0.5, 1, 1, 1.5]
  );
  assert.deepEqual(
    snapshots.map((snapshot) => snapshot.damage),
    [250, 650, 650, 850]
  );
  assert.deepEqual(
    snapshots.map((snapshot) => snapshot.dps),
    [500, 650, 650, 850 / 1.5]
  );
  assert.deepEqual(
    targetHealthBreakpointSnapshots(
      {
        dpsStartTime: 0,
        ...effectFields(
          [
            { type: 'damage', at: 1, damage: 100 },
            { type: 'damage', at: 2, damage: 100 }
          ],
          120
        )
      },
      1000,
      [80, 40, 20],
      40
    ).map(({ healthPercent, at }) => ({ healthPercent, at })),
    [{ healthPercent: 20, at: 2 }]
  );
  assert.deepEqual(targetHealthBreakpointSnapshots({}, 0), []);
});

test('target health breakpoints use environment damage for timing but player damage for DPS', () => {
  const snapshots = targetHealthBreakpointSnapshots(
    {
      dpsStartTime: 0.5,
      ...effectFields([{ type: 'damage', at: 0.5, damage: 100 }], 120),
      environmentConditionBreakdown: [
        {
          name: 'Burning',
          damageTicks: [{ at: 1, damage: 120 }]
        }
      ]
    },
    400,
    [50]
  );

  assert.deepEqual(snapshots, [
    {
      healthPercent: 50,
      at: 1,
      elapsed: 0.5,
      damage: 100,
      dps: 200,
      environmentDamage: 120,
      targetDamage: 220
    }
  ]);
});

test('summary metrics separate player attribution from right-grouped target damage', () => {
  const metrics = baseResultSummaryMetrics({
    rotationEndTime: 2,
    observationEndTime: 2,
    combatEndTime: 2,
    deathTime: null,
    totalDamage: 100,
    dps: 50,
    strikeDamage: 100,
    conditionDamage: 0,
    environmentDamage: 44,
    environmentDps: 22,
    environmentConditionBreakdown: [{ name: 'Bleeding', damage: 44 }]
  });
  const environment = metrics.find((metric) => metric.label === 'Environment Damage');

  assert.equal(metrics.find((metric) => metric.label === 'Player Damage').value, '100');
  assert.equal(metrics.find((metric) => metric.label === 'Player DPS').value, '50');
  assert.equal(environment.value, '44');
  assert.equal(environment.group, 'target');
  assert.equal(metrics.find((metric) => metric.label === 'Target Damage').value, '144');
  assert.deepEqual(environment.details, [
    { label: 'Environment DPS', value: '22' },
    { label: 'Bleeding', value: '44' }
  ]);
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

test('shared chart markup escapes effect names and uses scoped roles without ids', () => {
  const container = inertContainer();

  mountTimeSeriesCharts(
    container,
    {
      durationMs: 1000,
      damageContributions: { strike: [{ t: 1000, v: 1000 }], condition: [] },
      dps: [{ t: 0, v: 0 }],
      effects: {
        'Bad"><img src=x>': [{ t: 0, v: 1 }],
        Quickness: [{ t: 0, v: 2.5 }],
        Alacrity: [{ t: 0, v: 1.5 }],
        Torment: [{ t: 0, v: 3 }]
      },
      effectTypes: {
        Quickness: 'boon',
        Alacrity: 'boon',
        Torment: 'condition',
        'Bad"><img src=x>': 'buff'
      },
      effectUnits: { Quickness: 's' },
      cumulativeDamage: [
        { t: 0, v: 0 },
        { t: 1000, v: 1000 }
      ]
    },
    {
      targetDied: true,
      healthBreakpoints: [
        { healthPercent: 80, elapsed: 0.2, damage: 200 },
        { healthPercent: 60, elapsed: 0.4, damage: 400 },
        { healthPercent: 40, elapsed: 0.6, damage: 600 },
        { healthPercent: 20, elapsed: 0.8, damage: 800 }
      ]
    }
  );
  assert.match(container.innerHTML, /data-role="dps-canvas"/);
  assert.match(container.innerHTML, /Bad&quot;&gt;&lt;img src=x&gt;/);
  assert.match(container.innerHTML, /Quickness \(s\)/);
  assert.deepEqual(
    [...container.innerHTML.matchAll(/data-role="chart-toggle-group" data-effect-type="([^"]+)"/g)].map(
      (match) => match[1]
    ),
    ['boon', 'buff', 'condition']
  );
  assert.equal(
    container.innerHTML.indexOf('Alacrity'),
    Math.min(container.innerHTML.indexOf('Alacrity'), container.innerHTML.indexOf('Quickness'))
  );
  assert.equal([...container.innerHTML.matchAll(/data-toggle-action="all"/g)].length, 3);
  assert.equal([...container.innerHTML.matchAll(/data-toggle-action="none"/g)].length, 3);
  assert.match(container.innerHTML, /data-role="chart-phase-toggles"/);
  assert.match(container.innerHTML, /Chart range/);
  assert.match(container.innerHTML, /data-role="effects-panel-title"/);
  assert.match(container.innerHTML, /Full Fight/);
  assert.deepEqual(
    [...container.innerHTML.matchAll(/data-chart-phase="([^"]+)"/g)].map((match) => match[1]),
    ['full', '100-80', '80-60', '60-40', '40-20', '20-0']
  );
  const finalPhaseButton = container.innerHTML.match(
    /<button type="button"[\s\S]*?data-chart-phase="20-0"[\s\S]*?<\/button>/
  );

  assert.ok(finalPhaseButton);
  assert.doesNotMatch(finalPhaseButton[0], /disabled/);
  assert.doesNotMatch(container.innerHTML, /\sid="/);
});

// Mount the result flow so health metadata and completed-range controls are checked together.
for (const [startingHealthPercent, targetDied] of [
  [100, false],
  [100, true],
  [90, true],
  [80, true],
  [20, true]
]) {
  test(`chart health phases respect a ${startingHealthPercent}% start and target ${targetDied ? 'death' : 'survival'}`, () => {
    const chartContainer = inertContainer();
    const container = {
      ...inertContainer(),
      querySelector: (selector) => (selector === '[data-role="result-charts"]' ? chartContainer : null)
    };
    const view = createGw2SimulationViewModel({
      profession: { ui: normalizeProfessionUi('fixture') },
      adapter: { eliteSpecialization: () => 'Core' },
      build: {
        rotation: [{ type: 'cast', skillId: 'Strike' }],
        targetHealth: 100,
        targetStartingHealthPercent: startingHealthPercent
      },
      results: {
        rotationEndTime: 10,
        observationEndTime: 10,
        combatEndTime: 10,
        dpsStartTime: 0,
        deathTime: targetDied ? 10 : null,
        totalDamage: startingHealthPercent - (targetDied ? 0 : 10),
        conditionDamage: 0,
        ...effectFields(
          [
            { type: 'damage', at: 8, damage: startingHealthPercent - 20 },
            { type: 'damage', at: 10, damage: targetDied ? 20 : 10 }
          ],
          10
        )
      }
    });
    mountSimulationSection(container, view.analysis);

    const phaseEnabled = (id) => {
      const button = chartContainer.innerHTML.match(new RegExp(`<button[^>]*data-chart-phase="${id}"[^>]*>`));
      assert.ok(button, `Missing ${id} phase control`);
      return !button[0].includes('disabled');
    };

    assert.equal(phaseEnabled('20-0'), targetDied);
    assert.equal(phaseEnabled('100-80'), startingHealthPercent === 100);
    assert.equal(phaseEnabled('80-60'), startingHealthPercent === 80);
  });
}

test('chart canvases stay fluid when their initial container width is unavailable', () => {
  const context = {
    beginPath() {},
    clearRect() {},
    fillText() {},
    lineTo() {},
    moveTo() {},
    restore() {},
    save() {},
    setLineDash() {},
    setTransform() {},
    stroke() {}
  };
  const parentElement = { clientWidth: 0 };
  const canvas = () => ({
    closest: () => null,
    getContext: () => context,
    parentElement,
    style: {}
  });
  const dpsCanvas = canvas();
  const effectsCanvas = canvas();
  const canvases = new Map([
    ['[data-role="dps-canvas"]', dpsCanvas],
    ['[data-role="effects-canvas"]', effectsCanvas]
  ]);
  const container = {
    innerHTML: '',
    querySelector: (selector) => canvases.get(selector) || null,
    querySelectorAll: () => []
  };

  mountTimeSeriesCharts(container, {
    durationMs: 1000,
    damageContributions: { strike: [], condition: [] },
    dps: [{ t: 0, v: 100 }],
    effects: {}
  });

  assert.equal(dpsCanvas.width, 760);
  assert.equal(effectsCanvas.width, 760);
  assert.equal(dpsCanvas.style.width, '100%');
  assert.equal(effectsCanvas.style.width, '100%');
});

// Inspect renderer paths directly: count changes must not imply intermediate stacks, while countdowns can slope.
test('effect counts render as steps for both audiences while duration and DPS curves stay linear', () => {
  const strokes = [];
  let path = [];
  let dashed = false;
  const context = {
    beginPath() {
      path = [];
    },
    clearRect() {},
    fillText() {},
    lineTo(x, y) {
      path.push([x, y]);
    },
    moveTo(x, y) {
      path.push([x, y]);
    },
    restore() {},
    save() {},
    setLineDash(values) {
      dashed = values.length > 0;
    },
    setTransform() {},
    stroke() {
      if (this.lineWidth === 2) strokes.push({ color: this.strokeStyle, path: [...path], dashed });
    }
  };
  const canvases = new Map(
    ['dps', 'effects', 'conditions'].map((kind) => [
      `[data-role="${kind}-canvas"]`,
      { getContext: () => context, parentElement: { clientWidth: 760 }, style: {} }
    ])
  );
  const colors = { Might: '#112233', Buff: '#223344', Burning: '#334455', Duration: '#445566' };
  const both = { dataset: { boonAudience: 'both' }, setAttribute() {} };
  const container = {
    innerHTML: '',
    querySelector: (selector) => canvases.get(selector) || null,
    querySelectorAll: (selector) =>
      selector === '[data-series]:checked'
        ? Object.keys(colors).map((name) => ({ dataset: { series: name } }))
        : selector === '[data-boon-audience]'
          ? [both]
          : []
  };
  const points = [
    { t: 0, v: 1 },
    { t: 500, v: 3 },
    { t: 1000, v: 0 }
  ];
  mountTimeSeriesCharts(
    container,
    {
      durationMs: 1000,
      damageContributions: { strike: [{ t: 1000, v: 1000 }], condition: [] },
      dps: points,
      effects: Object.fromEntries(Object.keys(colors).map((name) => [name, points])),
      alliedEffects: { Might: points },
      effectTypes: { Might: 'boon', Buff: 'buff', Burning: 'condition', Duration: 'buff' },
      effectUnits: { Duration: 's' }
    },
    { colors, dpsColor: '#556677' }
  );
  strokes.length = 0;
  both.onclick();
  const hasDiagonal = (stroke) =>
    stroke.path.some(
      ([x, y], index) => index > 0 && x !== stroke.path[index - 1][0] && y !== stroke.path[index - 1][1]
    );
  for (const name of ['Might', 'Buff', 'Burning']) {
    const curves = strokes.filter((stroke) => stroke.color === colors[name]);
    assert.equal(curves.length, name === 'Might' ? 2 : 1);
    for (const curve of curves) {
      assert.equal(hasDiagonal(curve), false, `${name} must hold its previous count until the change`);
      assert.ok(
        curve.path.some(
          ([x, y], index) => index > 0 && x === curve.path[index - 1][0] && y !== curve.path[index - 1][1]
        )
      );
    }
  }

  assert.ok(strokes.some((stroke) => stroke.color === colors.Might && stroke.dashed));
  assert.ok(hasDiagonal(strokes.find((stroke) => stroke.color === colors.Duration)));
  assert.ok(hasDiagonal(strokes.find((stroke) => stroke.color === '#556677')));
});

test('result charts reuse the target-health DPS snapshot breakpoints', () => {
  const chartContainer = inertContainer();
  const container = {
    ...inertContainer(),
    querySelector: (selector) => (selector === '[data-role="result-charts"]' ? chartContainer : null),
    querySelectorAll: () => []
  };

  mountResultCharts(
    container,
    {
      chartSeries: {
        durationMs: 3000,
        damageContributions: { strike: [{ t: 3000, v: 4000 }], condition: [] },
        dps: [{ t: 0, v: 0 }],
        effects: {},
        cumulativeDamage: [
          { t: 0, v: 0 },
          { t: 3000, v: 4000 }
        ]
      }
    },
    {
      healthBreakpoints: [
        { healthPercent: 80, dps: 1200, elapsed: 1, damage: 1200 },
        { healthPercent: 60, dps: 1400, elapsed: 2, damage: 2800 }
      ]
    }
  );

  assert.match(chartContainer.innerHTML, /data-chart-phase="100-80"[\s\S]*?aria-pressed="false"/);
  assert.match(chartContainer.innerHTML, /data-chart-phase="80-60"[\s\S]*?aria-pressed="false"/);
});

// Both breakdowns share total damage as their denominator, including entity and environment rows.
test('damage contribution percentages share a denominator and handle empty damage', () => {
  const container = inertContainer();
  const skillRows = [
    { name: 'Strike', group: 'Player', total: 60 },
    { name: 'Burn', group: 'Entities', total: 30 },
    { name: 'External', group: 'Environment', total: 10 }
  ];
  mountDamageBreakdown(container, {
    skillRows,
    skillColumns: SKILL_COLS,
    conditions: [{ name: 'Burning', damage: 30, dps: 3, averageStacks: 1 }],
    conditionTotal: { damage: 30, dps: 3 }
  });
  assert.match(container.innerHTML, /data-sort-col="damagePercent"[^>]*>Share/);
  assert.match(container.innerHTML, /<span>Condition<\/span><span>Damage<\/span><span>Share<\/span>/);
  assert.match(container.innerHTML, /Player Share: 60\.00%/);
  assert.match(container.innerHTML, /Entities Share: 30\.00%/);
  assert.match(container.innerHTML, /Environment Share: 10\.00%/);
  assert.match(
    container.innerHTML,
    /102849\.png" alt="" \/>Burning<\/span>\s*<span class="condi">30<\/span>\s*<span>30\.00%<\/span>/
  );
  assert.match(container.innerHTML, /<b>30\.00%<\/b>/);
  assert.equal(skillRows[0].damagePercent, undefined);

  container.innerHTML = '';
  mountDamageBreakdown(container, {
    skillRows: [{ name: 'No damage', total: 0 }],
    skillColumns: SKILL_COLS,
    conditions: []
  });
  assert.match(container.innerHTML, /<span>0\.00%<\/span>/);
  assert.doesNotMatch(container.innerHTML, /NaN|Infinity/);
});

test('result sorting handles defaults, numeric directions, strings, and cycling', () => {
  assert.deepEqual(
    SKILL_COLS.map((column) => column.key),
    ['name', 'strike', 'condition', 'total', 'damagePercent', 'dps', 'average', 'dct', 'casts', 'hits', 'critChance']
  );
  const rows = [
    { name: 'Beta', total: 20, dps: 5 },
    { name: 'Alpha', total: 10, dps: 8 }
  ];
  const columns = [
    { key: 'name', numeric: false },
    { key: 'dps', numeric: true }
  ];

  assert.deepEqual(
    sortResultRows(rows, columns, null, null).map((row) => row.name),
    ['Beta', 'Alpha']
  );
  assert.deepEqual(
    sortResultRows(rows, columns, 'dps', 'asc').map((row) => row.name),
    ['Beta', 'Alpha']
  );
  assert.deepEqual(
    sortResultRows(rows, columns, 'dps', 'desc').map((row) => row.name),
    ['Alpha', 'Beta']
  );
  assert.deepEqual(
    sortResultRows(rows, columns, 'name', 'asc').map((row) => row.name),
    ['Alpha', 'Beta']
  );
  assert.deepEqual(nextResultSortState(null, null, 'dps'), {
    column: 'dps',
    direction: 'desc'
  });
  assert.deepEqual(nextResultSortState('dps', 'desc', 'dps'), {
    column: 'dps',
    direction: 'asc'
  });
  assert.deepEqual(nextResultSortState('dps', 'asc', 'dps'), {
    column: null,
    direction: null
  });
});

test('shared results render summaries, totals, contributions, and icons', () => {
  const container = inertContainer();
  const resolved = [];

  mountResultSummary(container, {
    metrics: [
      { label: 'Player DPS', value: '1,234', className: 'dps' },
      { label: 'Environment Damage', value: '50', className: 'environment', group: 'target' },
      { label: 'Target Damage', value: '1,284', className: 'target-damage', group: 'target' }
    ],
    breakpoints: [{ healthPercent: 80, dps: 1234, elapsed: 3.25 }]
  });
  mountRandomDistribution(container, {
    randomDistributionRequested: true,
    randomDistribution: {
      trials: 500,
      mean: 1234,
      p01: 1000,
      p10: 1100,
      p50: 1225,
      p90: 1350,
      p99: 1500,
      explanation: {
        cohortPercent: 10,
        lowDpsMean: 1040,
        highDpsMean: 1460,
        drivers: [
          {
            id: 'critical:illusion',
            label: 'Illusion critical hits',
            category: 'critical',
            unit: 'count',
            lowAverage: 18.2,
            highAverage: 25.4,
            delta: 7.2,
            correlation: 0.84,
            estimatedDpsDelta: 360
          }
        ]
      }
    }
  });
  mountDamageBreakdown(
    container,
    {
      skillRows: [
        { name: 'Low', total: 10 },
        { name: 'High', total: 20 }
      ],
      skillColumns: [
        { key: 'name', label: 'Skill', numeric: false },
        { key: 'total', label: 'Total', numeric: true }
      ],
      conditions: [
        { name: 'Weak <slow>', damage: 0, dps: 0, averageStacks: 0.5 },
        { name: 'Burn <hot>', damage: 25, dps: 5, averageStacks: 1.25 }
      ],
      conditionTotal: { label: 'Total Conditions', damage: 25, dps: 5 }
    },
    {
      resolveSkillIcon: (row) => {
        resolved.push(row.name);

        return `icon-${row.name}.png`;
      }
    }
  );
  mountModifierContributions(container, {
    contributions: [
      {
        name: 'Bonus',
        dpsIncrease: 12,
        pctIncrease: 1.5,
        icon: 'bonus.png'
      },
      {
        name: 'Noise',
        dpsIncrease: -0.1,
        pctIncrease: -0.001
      },
      {
        name: 'Penalty',
        dpsIncrease: -12,
        pctIncrease: -1.5
      }
    ],
    contributionsStale: false
  });

  assert.match(container.innerHTML, /res-summary/);
  assert.equal((container.innerHTML.match(/res-stat-target-start/g) || []).length, 1);
  assert.match(container.innerHTML, /<details class="res-dps-snapshots">/);
  assert.match(container.innerHTML, /DPS snapshots/);
  assert.doesNotMatch(container.innerHTML, /res-breakpoints/);
  assert.match(container.innerHTML, /80%<\/b> target health/);
  assert.match(container.innerHTML, />1,234</);
  assert.match(container.innerHTML, /at 3\.250s/);
  assert.ok(container.innerHTML.indexOf('>High</span>') < container.innerHTML.indexOf('>Low</span>'));
  assert.match(container.innerHTML, /Total Conditions/);
  assert.equal((container.innerHTML.match(/class="res-breakdown-section"/g) || []).length, 1);
  assert.doesNotMatch(container.innerHTML, /res-section-title"><svg/);
  assert.ok(container.innerHTML.indexOf('Damage Breakdown') < container.innerHTML.indexOf('Conditions'));
  assert.ok(container.innerHTML.indexOf('Damaging Conditions') < container.innerHTML.indexOf('Burn &lt;hot&gt;'));
  assert.ok(container.innerHTML.indexOf('Burn &lt;hot&gt;') < container.innerHTML.indexOf('Other Conditions'));
  assert.ok(container.innerHTML.indexOf('Other Conditions') < container.innerHTML.indexOf('Weak &lt;slow&gt;'));
  assert.match(container.innerHTML, /\+12/);
  assert.match(container.innerHTML, /\+1\.50%/);
  // Check signed display values independently of the spans used to arrange mobile metrics.
  const resultText = container.innerHTML.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  assert.match(resultText, /Noise DPS Increase 0 % Increase 0\.00%/);
  assert.match(resultText, /Penalty DPS Increase -12 % Increase -1\.50%/);
  assert.doesNotMatch(container.innerHTML, /-0(?:\.00)?%?/);
  assert.match(container.innerHTML, /<img src="bonus\.png" alt="" \/><span class="contrib-name-label">Bonus/);
  assert.match(container.innerHTML, /disabling each modifier and rerunning the simulation/);
  assert.match(container.innerHTML, /misleading if doing so breaks the rotation/);
  assert.match(container.innerHTML, /Randomized DPS range/);
  assert.match(container.innerHTML, /Recalculate/);
  assert.match(container.innerHTML, /500 simulations/);
  assert.match(container.innerHTML, /1st percentile 1,000/);
  assert.match(container.innerHTML, /99th percentile 1,500/);
  assert.match(container.innerHTML, /1,100&ndash;1,350/);
  assert.match(container.innerHTML, /What drove the difference\?/);
  assert.match(container.innerHTML, /Top 50 vs bottom 50 simulations/);
  assert.match(container.innerHTML, /The 50 highest-DPS simulations averaged 1,460 DPS/);
  assert.match(container.innerHTML, /The 50 lowest-DPS simulations averaged 1,040 DPS/);
  assert.match(container.innerHTML, /Illusion critical hits/);
  assert.match(container.innerHTML, /<td>25\.4<\/td>/);
  assert.match(container.innerHTML, /<td>18\.2<\/td>/);
  assert.match(container.innerHTML, /\+7\.2/);
  assert.match(container.innerHTML, /difference/);
  assert.match(container.innerHTML, /&asymp; \+360 DPS/);
  assert.match(container.innerHTML, /Est. DPS impact/);
  assert.match(container.innerHTML, /single-variable trend estimates/);
  assert.match(container.innerHTML, /averages across each group/);
  assert.match(container.innerHTML, /do not add them together/);
  assert.ok(container.innerHTML.indexOf('DPS snapshots') < container.innerHTML.indexOf('Randomized DPS range'));
  assert.deepEqual(resolved, ['High', 'Low']);

  assert.doesNotThrow(() => mountResultSummary(inertContainer(), { metrics: [] }));
});

test('modifier contribution errors are visible and escaped', () => {
  const container = inertContainer();

  mountModifierContributions(container, { contributionsError: 'Comparison <failed>' });

  assert.match(container.innerHTML, /Modifier Contributions/);
  assert.match(container.innerHTML, /class="contrib-pending contrib-error"/);
  assert.match(container.innerHTML, /Comparison &lt;failed&gt;/);
  assert.doesNotMatch(container.innerHTML, /Comparison <failed>/);
});

test('summary metrics render a clickable and escaped contributor disclosure', () => {
  const container = inertContainer();

  mountResultSummary(container, {
    metrics: [
      {
        label: 'Total Idle Time',
        value: '650ms',
        details: [
          { label: 'Idle time between skills', value: '250ms' },
          { label: "Skill cancelled '<Mind Stab>'", value: '400ms' }
        ]
      }
    ]
  });

  assert.match(container.innerHTML, /<details class="res-metric-info">/);
  assert.match(container.innerHTML, /aria-label="Show Total Idle Time breakdown"/);
  assert.match(container.innerHTML, /Idle time between skills/);
  assert.match(container.innerHTML, /Skill cancelled '&lt;Mind Stab&gt;'/);
  assert.doesNotMatch(container.innerHTML, /Skill cancelled '<Mind Stab>'/);
});

test('summary metric disclosures stay open for internal clicks and dismiss on click away', () => {
  const inside = {};
  const outside = {};
  const clickedDetails = { open: true, contains: (target) => target === inside };
  const otherDetails = { open: true, contains: () => false };
  const root = {
    querySelectorAll: () => [clickedDetails, otherDetails]
  };

  dismissResultMetricDetails(root, inside);
  assert.equal(clickedDetails.open, true);
  assert.equal(otherDetails.open, false);

  dismissResultMetricDetails(root, outside);
  assert.equal(clickedDetails.open, false);
});

test('summary metric click-away dismissal binds before the native details click toggle', () => {
  const eventTypes = [];
  const ownerDocument = {
    addEventListener: (type) => eventTypes.push(type),
    querySelectorAll: () => []
  };
  const container = { ...inertContainer(), ownerDocument };

  mountResultSummary(container, { metrics: [] });

  assert.deepEqual(eventTypes, ['pointerdown']);
});

test('skill damage rows group player damage before owned entities', () => {
  const container = inertContainer();

  mountDamageBreakdown(container, {
    skillRows: [
      {
        name: 'Player Low',
        strike: 6,
        condition: 4,
        total: 10,
        dps: 2,
        group: 'Player'
      },
      {
        name: 'Entity High',
        strike: 75,
        condition: 25,
        total: 100,
        dps: 20,
        group: 'Entities'
      },
      {
        name: 'Player High',
        strike: 15,
        condition: 5,
        total: 20,
        dps: 4,
        group: 'Player'
      },
      {
        name: 'Entity Low',
        strike: 30,
        condition: 20,
        total: 50,
        dps: 10,
        group: 'Entities'
      }
    ],
    skillColumns: [
      { key: 'name', label: 'Skill', numeric: false },
      { key: 'strike', label: 'Strike', numeric: true },
      {
        key: 'condition',
        label: 'Condition',
        numeric: true,
        className: 'condi'
      },
      { key: 'total', label: 'Total', numeric: true, className: 'total' },
      { key: 'dps', label: 'DPS', numeric: true, className: 'dps' }
    ],
    conditions: []
  });

  const html = container.innerHTML;
  const playerGroup = html.indexOf('data-skill-group="Player"');
  const entityGroup = html.indexOf('data-skill-group="Entities"');

  assert.ok(playerGroup >= 0);
  assert.ok(entityGroup > playerGroup);
  assert.ok(html.indexOf('Player High') < html.indexOf('Player Low'));
  assert.ok(html.indexOf('Player Low') < entityGroup);
  assert.ok(html.indexOf('Entity High') < html.indexOf('Entity Low'));
  assert.match(html, /aria-label="Player Strike: 21">21</);
  assert.match(html, /aria-label="Player Condition: 9">9</);
  assert.match(html, /aria-label="Player Total: 30">30</);
  assert.match(html, /aria-label="Player DPS: 6">6</);
  assert.match(html, /aria-label="Entities Strike: 105">105</);
  assert.match(html, /aria-label="Entities Condition: 45">45</);
  assert.match(html, /aria-label="Entities Total: 150">150</);
  assert.match(html, /aria-label="Entities DPS: 30">30</);
});

test('randomized DPS range waits for its calculate button', () => {
  const runButton = {};
  const container = {
    ...inertContainer(),
    querySelector: (selector) => (selector === '[data-role="rng-run"]' ? runButton : null)
  };
  let runCount = 0;

  mountRandomDistribution(
    container,
    { randomDistributionRequested: true, randomDistributionTrials: 500 },
    {
      onRunRandomDistribution() {
        runCount += 1;
      }
    }
  );

  assert.match(container.innerHTML, /weapon strength and supported random procs/);
  assert.match(container.innerHTML, /500 simulations/);
  assert.match(container.innerHTML, /Calculate range/);
  assert.equal(typeof runButton.onclick, 'function');
  runButton.onclick();
  assert.equal(runCount, 1);
});

test('randomized DPS range renders completed simulations and percentage progress', () => {
  const container = inertContainer();

  mountRandomDistribution(container, {
    randomDistributionRequested: true,
    randomDistributionStale: true,
    randomDistributionTrials: 500,
    randomDistributionProgress: {
      completed: 125,
      total: 500,
      percent: 25
    }
  });

  assert.match(container.innerHTML, /role="progressbar"/);
  assert.match(container.innerHTML, /aria-valuenow="25"/);
  assert.match(container.innerHTML, /style="width: 25%"/);
  assert.match(container.innerHTML, /125 \/ 500 simulations \(25%\)/);
});

test('event log CSV escapes cells', () => {
  const rows = [{ at: 0, type: 'action', description: 'CAST Quote "skill"' }];

  assert.match(eventLogCsv(rows), /"CAST Quote ""skill"""/);
});

// Same-time rows follow activation order, including instant casts and derived hits with different names.
test('event log finishes an activation before the next same-time cast', () => {
  const rows = simulationEventLogRows({
    events: [
      { type: 'action', activationId: 'first', at: 0, endsAt: 0, name: 'Z' },
      { type: 'action', activationId: 'second', at: 0, endsAt: 0, name: 'A' },
      { type: 'action', activationId: 'third', at: 0, endsAt: 1, name: 'Z' },
      { type: 'action', activationId: 'fourth', at: 1, endsAt: 2, name: 'B' },
      { type: 'combat_start', at: 0 }
    ],
    resolvedEvents: [
      { type: 'damage', activationId: 'third', at: 1, name: 'Derived hit', damage: 1 },
      { type: 'damage', activationId: 'fourth', at: 1, name: 'Opening hit', damage: 1 },
      { type: 'damage', activationId: 'first', at: 1.5, name: 'Delayed hit', damage: 1 }
    ]
  });

  assert.deepEqual(
    rows.map(({ at, description }) => [at, description]),
    [
      [0, 'COMBAT START'],
      [0, 'CAST Z (0ms)'],
      [0, 'END Z'],
      [0, 'CAST A (0ms)'],
      [0, 'END A'],
      [0, 'CAST Z (1000ms)'],
      [1, 'HIT Derived hit x1 -> 1 damage'],
      [1, 'END Z'],
      [1, 'CAST B (1000ms)'],
      [1, 'HIT Opening hit x1 -> 1 damage'],
      [1.5, 'HIT Delayed hit x1 -> 1 damage'],
      [2, 'END B']
    ]
  );
});

// A remount keeps the previous search, so only matching rows render with their escaped details.
test('event-log mounting keeps the search, escapes descriptions, and configures filename', () => {
  let html = '';
  let mounted = false;
  const container = {
    get innerHTML() {
      return html;
    },
    set innerHTML(value) {
      html = value;
      mounted = true;
    },
    querySelector(selector) {
      if (mounted) return null;
      if (selector.includes('event-log-details')) return { open: true };
      if (selector.includes('event-log-search')) return { value: 'safe' };

      return null;
    },
    querySelectorAll() {
      return [];
    }
  };

  mountEventLog(
    container,
    [
      { at: 0, type: 'one', description: 'Keep <safe>', details: ['Power <1000>'] },
      { at: 1, type: 'two', description: 'Drop me' }
    ],
    { filename: 'custom"name.csv' }
  );

  assert.match(html, /<details class="log-desc"><summary>Keep &lt;<mark>safe<\/mark>&gt;<\/summary>/);
  assert.match(html, /<li>Power &lt;1000&gt;<\/li>/);
  assert.doesNotMatch(html, /Drop me/);
  assert.match(html, /data-filename="custom&quot;name\.csv"/);
  assert.match(html, /value="safe"/);
});

// Calculation details retain microseconds and actual factors without changing rows from older results.
test('event log exposes optional damage calculations at full simulation precision', () => {
  const event = {
    type: 'damage',
    at: 0.600001,
    source: 'Player',
    sourceId: 'hit',
    actorType: 'player',
    name: 'Hit',
    flatDamage: 10,
    damage: 10,
    criticalChance: 0
  };
  const result = { events: [], ...effectFields([event], 120) };
  assert.equal(simulationEventLogRows(result)[0].details, undefined);
  const damageCalculation = {
    phase: 'Ordinary',
    targetHealthBefore: null,
    targetHealthFractionBefore: null,
    power: 1000,
    coefficientMultiplier: 1,
    baseDamage: 10,
    criticalMultiplier: 1,
    outgoingMultiplier: 1,
    unroundedDamage: 10,
    rounding: 'floor'
  };
  const row = simulationEventLogRows({ ...result, ...effectFields([{ ...event, damageCalculation }], 120) })[0];
  assert.ok(row.details.includes('Simulation time: 0.600001s; phase: Ordinary'));
  assert.ok(row.details.includes('Target health before: unbounded; fraction: unbounded'));
  assert.ok(row.details.includes('Unrounded damage: 10; rounding: floor; damage: 10'));
  assert.ok(!row.details.some((detail) => detail.startsWith('Weapon strength:')));
});

test('event log distinguishes phantasm summon, attack, and clone conversion', () => {
  const result = simulateMesmer(
    ['Phantasmal Duelist', { name: '__wait', waitMs: 7000 }],
    defaultSimulationConfig({
      specialization: 'Core',
      primaryWeapon: 'Scepter',
      secondaryWeapon: 'Pistol',
      initialResource: 0
    })
  );
  const log = simulationEventLogRows(result, null, withPatchPreview(mesmerProfession));

  assert.ok(
    log.some(
      (event) => Math.abs(event.at - 0.56) < 0.00001 && event.description === 'PHANTASM SUMMONED Phantasmal Duelist x1'
    )
  );
  assert.ok(
    log.some(
      (event) =>
        Math.abs(event.at - 2.8) < 0.00001 && event.description === 'PHANTASM DAMAGE COMPLETE Phantasmal Duelist x1'
    )
  );
  assert.ok(
    log.some(
      (event) =>
        Math.abs(event.at - 3.36) < 0.00001 &&
        event.description.includes('CLONE SPAWNED x1') &&
        event.description.includes('Phantasmal Duelist phantasm conversion')
    )
  );
  assert.match(eventLogCsv(log), /Phantasmal Duelist phantasm conversion/);
});
