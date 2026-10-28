import assert from 'node:assert/strict';
import test from 'node:test';

import { comparisonResult } from '#gw2/app/page/benchmark-comparison/model.js';
import { buildTimeSeries } from '#gw2/app/results/charts/time-series-model.js';
import { baseResultSummaryMetrics, targetHealthBreakpointSnapshots } from '#gw2/app/results/summary-metrics.js';
import { dismissResultMetricDetails, mountResultSummary } from '#gw2/app/results/summary-view.js';
import { inertContainer } from '#tests/helpers/dom.js';
import { effectFields } from '#tests/helpers/effect-report.js';

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
      dps: 200
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

// Views may display aggregate-only events, but target health must follow actual condition payouts.
test('damage reports share packet expansion while health milestones require recorded condition payouts', () => {
  const result = {
    dpsStartTime: 0,
    combatEndTime: 4,
    deathTime: null,
    dps: 47.5,
    warnings: [],
    resolvedEvents: [
      { type: 'condition', condition: 'Burning', at: 1, damage: 40 },
      { type: 'condition', condition: 'Burning', at: 2, damage: 0, damageTicks: [] },
      { type: 'condition', condition: 'Burning', at: 0, damage: 100, damageTicks: [{ at: 3, damage: 100 }] },
      { type: 'damage', at: 3, damage: 50, didCrit: true, averagedCriticalDamage: true }
    ]
  };
  const series = buildTimeSeries(result, 250, { includeEffects: false, skillKey: (event) => event.type });
  assert.equal(series.cumulativeDamage.at(-1).v, 190);
  assert.equal(comparisonResult(result).damage.at(-1).v, 190);
  assert.equal(
    series.skillDamage.condition.reduce((total, hit) => total + hit.v, 0),
    140
  );
  assert.equal(series.skillDamage.damage[0].crit, true);
  assert.equal(series.skillDamage.damage[0].averagedCriticalDamage, true);
  assert.deepEqual(targetHealthBreakpointSnapshots(result, 500), [
    { healthPercent: 80, at: 3, elapsed: 3, damage: 150, dps: 50 }
  ]);
});
