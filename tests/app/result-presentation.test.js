import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildChartSeries,
  buildPhaseDpsSeries,
  buildPhaseEffectSeries,
  chartValueAt
} from '#gw2/app/results/charts/time-series-model.js';
import { mountTimeSeriesCharts } from '#gw2/app/results/charts/time-series-view.js';
import { eventLogCsv, mountEventLog } from '#gw2/app/results/event-log-view.js';
import { resultSummaryMetrics, targetHealthBreakpointSnapshots } from '#gw2/app/results/result-transform.js';
import {
  dismissResultMetricDetails,
  mountRotationResults,
  nextResultSortState,
  SKILL_COLS,
  sortResultRows
} from '#gw2/app/results/rotation-results.js';
import { inertContainer } from '../helpers/dom.js';

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

  const series = buildChartSeries(
    {
      duration: 9,
      deathTime: 2,
      dpsStartTime: 0.5,
      resolvedEvents: [
        { type: 'damage', at: 0.5, damage: 100 },
        {
          type: 'condition',
          at: 1,
          condition: 'burn',
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
      effectName: (value) => `Effect <${value}>`,
      stackCaps: { 'Effect <burn>': 2 }
    }
  );

  assert.equal(series.durationMs, 1500);
  assert.equal(series.dps[0].v, 0);
  assert.equal(series.dps[1].v, 150);
  assert.equal(series.dps.at(-1).v, 400 / 1.5);
  assert.equal(series.cumulativeDamage.at(-1).v, 400);
  assert.equal(series.effects['Effect <burn>'][1].v, 2);
  assert.equal(series.effects['Effect <burn>'].at(-1).v, 2);
  assert.equal(series.effects['Effect <power>'][0].v, 2);
  assert.deepEqual(series.effectTypes, {
    'Effect <burn>': 'condition',
    'Effect <power>': 'buff'
  });
});

test('shared DPS charts start their sample grid at the first hit', () => {
  const series = buildChartSeries({
    duration: 2,
    dpsStartTime: 1.156,
    resolvedEvents: [
      { type: 'damage', at: 1.156, damage: 3567 },
      { type: 'damage', at: 1.32, damage: 916 }
    ]
  });

  assert.equal(series.durationMs, 844);
  assert.deepEqual(series.dps.slice(0, 2), [
    { t: 0, v: 0 },
    { t: 250, v: 4483 / 0.25 }
  ]);
});

test('target health breakpoints use cumulative damage and individual condition ticks', () => {
  const snapshots = targetHealthBreakpointSnapshots(
    {
      dpsStartTime: 0.5,
      resolvedEvents: [
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
      ]
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
        resolvedEvents: [
          { type: 'damage', at: 1, damage: 100 },
          { type: 'damage', at: 2, damage: 100 }
        ]
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
      resolvedEvents: [{ type: 'damage', at: 0.5, damage: 100 }],
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
  const metrics = resultSummaryMetrics({
    duration: 2,
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

test('shared chart markup escapes effect names and uses scoped roles without ids', () => {
  const container = inertContainer();

  mountTimeSeriesCharts(
    container,
    {
      durationMs: 1000,
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
    ['boon', 'condition', 'buff']
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
    dps: [{ t: 0, v: 100 }],
    effects: {}
  });

  assert.equal(dpsCanvas.width, 760);
  assert.equal(effectsCanvas.width, 760);
  assert.equal(dpsCanvas.style.width, '100%');
  assert.equal(effectsCanvas.style.width, '100%');
});

test('result charts reuse the target-health DPS snapshot breakpoints', () => {
  const chartContainer = inertContainer();
  const container = {
    innerHTML: '',
    querySelector: (selector) => (selector === '[data-role="result-charts"]' ? chartContainer : null),
    querySelectorAll: () => []
  };

  mountRotationResults(container, {
    breakpoints: [
      { healthPercent: 80, dps: 1200, elapsed: 1, damage: 1200 },
      { healthPercent: 60, dps: 1400, elapsed: 2, damage: 2800 }
    ],
    chartSeries: {
      durationMs: 3000,
      dps: [{ t: 0, v: 0 }],
      effects: {},
      cumulativeDamage: [
        { t: 0, v: 0 },
        { t: 3000, v: 4000 }
      ]
    }
  });

  assert.match(chartContainer.innerHTML, /data-chart-phase="100-80"[\s\S]*?aria-pressed="false"/);
  assert.match(chartContainer.innerHTML, /data-chart-phase="80-60"[\s\S]*?aria-pressed="false"/);
});

test('result sorting handles defaults, numeric directions, strings, and cycling', () => {
  assert.deepEqual(
    SKILL_COLS.map((column) => column.key),
    ['name', 'strike', 'condition', 'total', 'dps', 'average', 'dct', 'casts', 'hits', 'critChance']
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

  mountRotationResults(
    container,
    {
      metrics: [
        { label: 'Player DPS', value: '1,234', className: 'dps' },
        { label: 'Environment Damage', value: '50', className: 'environment', group: 'target' },
        { label: 'Target Damage', value: '1,284', className: 'target-damage', group: 'target' }
      ],
      breakpoints: [{ healthPercent: 80, dps: 1234, elapsed: 3.25 }],
      skillColumns: [
        { key: 'name', label: 'Skill', numeric: false },
        { key: 'total', label: 'Total', numeric: true }
      ],
      skillRows: [
        { name: 'Low', total: 10 },
        { name: 'High', total: 20 }
      ],
      conditions: [
        { name: 'Weak <slow>', damage: 0, dps: 0, averageStacks: 0.5 },
        { name: 'Burn <hot>', damage: 25, dps: 5, averageStacks: 1.25 }
      ],
      conditionTotal: { label: 'Total Conditions', damage: 25, dps: 5 },
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
      contributionsStale: true,
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
              overallAverage: 21.5,
              highAverage: 25.4,
              delta: 7.2,
              correlation: 0.84,
              estimatedDpsDelta: 360
            }
          ]
        }
      }
    },
    {
      resolveSkillIcon: (row) => {
        resolved.push(row.name);

        return `icon-${row.name}.png`;
      }
    }
  );

  assert.match(container.innerHTML, /res-summary/);
  assert.equal((container.innerHTML.match(/res-stat-target-start/g) || []).length, 1);
  assert.match(container.innerHTML, /<details class="res-dps-snapshots">/);
  assert.match(container.innerHTML, /DPS snapshots/);
  assert.doesNotMatch(container.innerHTML, /res-breakpoints/);
  assert.match(container.innerHTML, /80%<\/b> target health/);
  assert.match(container.innerHTML, />1,234</);
  assert.match(container.innerHTML, /at 3\.25s/);
  assert.ok(container.innerHTML.indexOf('High') < container.innerHTML.indexOf('Low'));
  assert.match(container.innerHTML, /Total Conditions/);
  assert.equal((container.innerHTML.match(/class="res-breakdown-section"/g) || []).length, 1);
  assert.doesNotMatch(container.innerHTML, /res-section-title"><svg/);
  assert.ok(container.innerHTML.indexOf('Damage Breakdown') < container.innerHTML.indexOf('Conditions'));
  assert.ok(container.innerHTML.indexOf('Damaging Conditions') < container.innerHTML.indexOf('Burn &lt;hot&gt;'));
  assert.ok(container.innerHTML.indexOf('Burn &lt;hot&gt;') < container.innerHTML.indexOf('Other Conditions'));
  assert.ok(container.innerHTML.indexOf('Other Conditions') < container.innerHTML.indexOf('Weak &lt;slow&gt;'));
  assert.match(container.innerHTML, /\+12/);
  assert.match(container.innerHTML, /\+1\.50%/);
  assert.match(
    container.innerHTML,
    /Noise<\/span>\s*<span class="contrib-val">0<\/span>\s*<span class="contrib-pct">0\.00%/
  );
  assert.match(
    container.innerHTML,
    /Penalty<\/span>\s*<span class="contrib-val">-12<\/span>\s*<span class="contrib-pct">-1\.50%/
  );
  assert.doesNotMatch(container.innerHTML, /-0(?:\.00)?%?/);
  assert.match(container.innerHTML, /<img src="bonus\.png" alt="" \/>Bonus/);
  assert.match(container.innerHTML, /contrib-status/);
  assert.match(container.innerHTML, /Recalculating/);
  assert.match(container.innerHTML, /disabling each modifier and rerunning the simulation/);
  assert.match(container.innerHTML, /misleading if doing so breaks the rotation/);
  assert.match(container.innerHTML, /Randomized DPS range/);
  assert.match(container.innerHTML, /Recalculate/);
  assert.match(container.innerHTML, /500 simulations/);
  assert.match(container.innerHTML, /Rare low outcome/);
  assert.match(container.innerHTML, /About 1 in 100 runs are lower/);
  assert.match(container.innerHTML, /Rare high outcome/);
  assert.match(container.innerHTML, /About 1 in 100 runs are higher/);
  assert.match(container.innerHTML, /1,100&ndash;1,350/);
  assert.match(container.innerHTML, /What was different in the highest-DPS simulations\?/);
  assert.match(container.innerHTML, /50 highest vs 50 lowest/);
  assert.match(container.innerHTML, /The 50 highest-DPS simulations averaged 1,460 DPS/);
  assert.match(container.innerHTML, /The 50 lowest-DPS simulations averaged 1,040 DPS/);
  assert.match(container.innerHTML, /Illusion critical hits/);
  assert.match(container.innerHTML, /Highest-DPS group: 25\.4 average per simulation/);
  assert.match(container.innerHTML, /Lowest-DPS group: 18\.2 average per simulation/);
  assert.match(container.innerHTML, /\+7\.2/);
  assert.match(container.innerHTML, /difference/);
  assert.match(container.innerHTML, /&asymp; \+360 DPS/);
  assert.match(container.innerHTML, /estimated DPS difference/);
  assert.match(container.innerHTML, /single-variable trend estimates/);
  assert.match(container.innerHTML, /averages across each group/);
  assert.match(container.innerHTML, /do not add them together/);
  assert.ok(container.innerHTML.indexOf('DPS snapshots') < container.innerHTML.indexOf('Randomized DPS range'));
  assert.deepEqual(resolved, ['High', 'Low']);

  assert.doesNotThrow(() => mountRotationResults(inertContainer(), {}));
});

test('modifier contribution errors are visible and escaped', () => {
  const container = inertContainer();

  mountRotationResults(container, {
    contributionsError: 'Comparison <failed>'
  });

  assert.match(container.innerHTML, /Modifier Contributions/);
  assert.match(container.innerHTML, /class="contrib-pending contrib-error"/);
  assert.match(container.innerHTML, /Comparison &lt;failed&gt;/);
  assert.doesNotMatch(container.innerHTML, /Comparison <failed>/);
});

test('summary metrics render a clickable and escaped contributor disclosure', () => {
  const container = inertContainer();

  mountRotationResults(container, {
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

  mountRotationResults(container, { metrics: [] });

  assert.deepEqual(eventTypes, ['pointerdown']);
});

test('skill damage rows group player damage before owned entities', () => {
  const container = inertContainer();

  mountRotationResults(container, {
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
    ]
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

  mountRotationResults(
    container,
    {
      metrics: [],
      randomDistributionRequested: true,
      randomDistributionTrials: 500
    },
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

test('relic comparison passes the selected relic and shows stacks only for Thorns', () => {
  const runButton = {};
  const targetInput = { value: 'Thorns' };
  const stackInput = { value: '4' };
  const stackControl = { hidden: false };
  const container = {
    ...inertContainer(),
    querySelector: (selector) =>
      selector === '[data-role="relic-comparison-run"]'
        ? runButton
        : selector === '[data-role="relic-comparison-target"]'
          ? targetInput
          : selector === '[data-role="relic-comparison-stacks-control"]'
            ? stackControl
            : selector === '[data-role="relic-comparison-stacks"]'
              ? stackInput
              : null
  };
  let targetRelic = null;
  let startingStacks = null;

  mountRotationResults(
    container,
    {
      metrics: [],
      relicComparisonAvailable: true,
      relicComparisonOpponent: 'Fractal',
      relicComparisonTarget: 'Thorns',
      relicComparisonTargets: ['Akeem', 'Thorns'],
      relicComparisonInitialStacks: 4
    },
    {
      onRunRelicComparison(relic, stacks) {
        targetRelic = relic;
        startingStacks = stacks;
      }
    }
  );

  assert.match(container.innerHTML, /Relic break-even comparison/);
  assert.doesNotMatch(container.innerHTML, /Off by default/);
  assert.match(container.innerHTML, /<option value="Akeem">Relic of Akeem<\/option>/);
  assert.doesNotMatch(container.innerHTML, /value="Fractal"/);
  assert.match(container.innerHTML, /aria-label="Starting Thorns stacks"/);
  assert.match(container.innerHTML, /min="0" max="10" step="1" value="4"/);
  targetInput.value = 'Akeem';
  targetInput.onchange();
  assert.equal(stackControl.hidden, true);
  runButton.onclick();
  assert.equal(targetRelic, 'Akeem');
  assert.equal(startingStacks, 4);
});

test('relic comparison keeps its footprint while rerunning', () => {
  const container = inertContainer();

  mountRotationResults(container, {
    metrics: [],
    relicComparisonAvailable: true,
    relicComparisonStale: true,
    relicComparisonOpponent: 'Fractal',
    relicComparisonTarget: 'Thorns',
    relicComparisonTargets: ['Thorns']
  });

  assert.match(container.innerHTML, /class="relic-cmp-skeleton" role="status"/);
  assert.match(container.innerHTML, /data-role="relic-comparison-run" disabled/);
  assert.match(container.innerHTML, /Running…/);
});

test('randomized DPS range renders completed simulations and percentage progress', () => {
  const container = inertContainer();

  mountRotationResults(container, {
    metrics: [],
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

test('event-log mounting filters rows, escapes descriptions, and configures filename', () => {
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
      if (!mounted && selector.includes('event-log-details')) return { open: true };

      return null;
    },
    querySelectorAll(selector) {
      if (!mounted && selector.includes(':checked')) {
        return [{ dataset: { filterId: 'kept' } }];
      }

      return [];
    }
  };

  mountEventLog(
    container,
    [
      { at: 0, type: 'one', description: 'Keep <safe>', keep: true },
      { at: 1, type: 'two', description: 'Drop me', keep: false }
    ],
    {
      filename: 'custom"name.csv',
      filters: [
        {
          id: 'kept',
          label: 'Kept only',
          predicate: (row) => row.keep
        }
      ]
    }
  );

  assert.match(html, /Keep &lt;safe&gt;/);
  assert.doesNotMatch(html, /Drop me/);
  assert.match(html, /data-filename="custom&quot;name\.csv"/);
  assert.match(html, /log-filter-kept/);
});
