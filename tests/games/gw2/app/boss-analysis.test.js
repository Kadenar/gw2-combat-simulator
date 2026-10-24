import { layoutChartMarkerLabels } from '#gw2/app/results/charts/marker-layout.js';
import { mountResultSummary } from '#gw2/app/results/summary-view.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { encounterAnalysisPhases, encounterDpsSnapshots } from '#gw2/app/boss-scenarios/analysis-model.js';
import { mountEncounterAnalysis } from '#gw2/app/boss-scenarios/analysis-view.js';
import { createGw2SimulationViewModel } from '#gw2/app/results/view.js';
import { mountTimeSeriesCharts } from '#gw2/app/results/charts/time-series-view.js';
import { buildPhaseDpsSeries, buildTimeSeries } from '#gw2/app/results/charts/time-series-model.js';
import { inertContainer } from '#tests/helpers/dom.js';

const definitions = [
  { id: 'boss', label: '100% to 50%' },
  { id: 'split', label: 'Charged Souls' }
];
const fixture = () => ({
  dpsStartTime: 5,
  combatEndTime: 20,
  encounter: {
    phases: [
      { id: 'boss', kind: 'boss', start: 5, end: 10, playerDamage: 1000, groupDamage: 4000 },
      { id: 'split', kind: 'split', start: 10, end: 15, playerDamage: 0, groupDamage: 0 },
      { id: 'boss', kind: 'boss', start: 15, end: null, playerDamage: 500, groupDamage: 2000 }
    ]
  }
});

// Phase projections preserve encounter time, independent squad attribution, and the denominator through invulnerability.
test('boss analysis keeps split downtime in overall DPS and distinguishes repeated partial phases', () => {
  const result = fixture();
  const before = structuredClone(result);
  const rows = encounterAnalysisPhases(result, definitions);
  assert.deepEqual(
    rows.map((row) => [row.startMs, row.endMs]),
    [
      [0, 5000],
      [5000, 10000],
      [10000, 15000]
    ]
  );
  assert.deepEqual(
    rows.map((row) => row.playerDps),
    [200, 0, 100]
  );
  assert.deepEqual(
    rows.map((row) => row.groupDps),
    [800, 0, 400]
  );
  assert.deepEqual(
    rows.map((row) => row.overallDps),
    [200, 100, 100]
  );
  assert.deepEqual(
    rows.map((row) => row.complete),
    [true, true, false]
  );
  assert.equal(new Set(rows.map((row) => row.id)).size, 3);
  assert.equal(rows[1].label, 'Split 1: Charged Souls');
  assert.equal(rows[2].label, 'Phase 2');
  assert.deepEqual(result, before);
});

test('zero-duration splits stay visible without dividing by zero or inventing elapsed time', () => {
  const result = fixture();
  result.encounter.phases[1].end = 10;
  result.encounter.phases[2].start = 10;
  const rows = encounterAnalysisPhases(result, definitions);
  assert.equal(rows[1].duration, 0);
  assert.equal(rows[1].playerDps, 0);
  assert.equal(rows[1].groupDps, 0);
  assert.equal(rows[1].overallDps, 200);
  assert.equal(rows[2].duration, 10);
});

test('full-fight charts decline during splits while phase curves restart their damage clock', () => {
  const result = fixture();
  const series = buildTimeSeries(
    {
      ...result,
      resolvedEvents: [
        { type: 'damage', at: 6, damage: 1000 },
        { type: 'damage', at: 16, damage: 500 }
      ]
    },
    250,
    { includeEffects: false }
  );
  const at = (time) => series.dps.find((point) => point.t === time).v;
  assert.equal(at(5000), 200);
  assert.equal(at(10000), 100);
  const phases = encounterAnalysisPhases(result, definitions);
  for (const phase of phases) {
    const points = buildPhaseDpsSeries(
      series.cumulativeDamage,
      phase.startMs,
      phase.endMs,
      phase.startDamage,
      phase.endDamage
    );
    assert.equal(points.at(-1).v, phase.playerDps);
  }

  const container = inertContainer();
  mountTimeSeriesCharts(container, series, { encounterPhases: phases });
  assert.deepEqual(
    [...container.innerHTML.matchAll(/data-chart-phase="([^"]+)"/g)].map((match) => match[1]),
    ['full', 'encounter-0', 'encounter-2']
  );
  assert.doesNotMatch(container.innerHTML, /data-chart-phase="100-80"/);
});

test('boss analysis preserves separate target bars and links an empty scenario back to Bosses', () => {
  const result = fixture();
  result.encounter.targets = [
    { name: 'Nikare', maximumHealth: 10000, remainingHealth: 4000, armor: 2597 },
    { name: 'Kenut', maximumHealth: 20000, remainingHealth: 15000, armor: 2597 }
  ];
  const container = inertContainer();
  mountEncounterAnalysis(container, result.encounter, encounterAnalysisPhases(result, definitions));
  assert.match(container.innerHTML, /Nikare/);
  assert.match(container.innerHTML, /Kenut/);
  assert.match(container.innerHTML, /40.00%/);
  assert.match(container.innerHTML, /75.00%/);
  assert.match(container.innerHTML, /in progress/);
  assert.doesNotMatch(container.innerHTML, /Charged Souls|data-encounter-phase="encounter-1"/);
  assert.match(container.innerHTML, /data-encounter-phase="encounter-2"/);
  const app = { build: { rotation: [] }, workspace: { scenario: {} } };
  assert.match(createGw2SimulationViewModel(app).analysisEmptyHtml, /href="#bosses"/);
  app.build.rotation = [{ type: 'wait', durationMs: 1000 }];
  app.results = { totalDamage: 99999 };
  assert.equal(createGw2SimulationViewModel(app).analysis, null);
  assert.match(createGw2SimulationViewModel(app).analysisEmptyHtml, /Loading combat analysis/);
});

// Phase results share the golem disclosure without treating downtime or unreached health bands as damage phases.
test('DPS strip snapshots show observed phase DPS, including repeated and unfinished stages', () => {
  const snapshots = encounterDpsSnapshots(encounterAnalysisPhases(fixture(), definitions));
  assert.deepEqual(
    snapshots.map((row) => row.dps),
    [200, 100]
  );
  assert.deepEqual(
    snapshots.map((row) => row.label),
    ['Phase 1', 'Phase 2']
  );
  assert.match(snapshots[1].detail, /in progress/);
  const container = inertContainer();
  mountResultSummary(container, {
    metrics: [{ label: 'Overall DPS', value: '100', className: 'dps' }],
    phaseSnapshots: snapshots
  });
  assert.match(container.innerHTML, /Show Phase DPS/);
  assert.match(container.innerHTML, /res-dps-snapshots-panel/);
  assert.doesNotMatch(container.innerHTML, /Charged Souls|target health/);
});

// Collision layout is renderer-independent: names stay within the viewport and never occupy the same lane space.
test('nearby split and phase labels use separate lanes while transition positions remain exact', () => {
  const markers = [
    { timeMs: 0, label: 'Phase 1', color: 'gold' },
    { timeMs: 20000, label: 'Split 1: Hands of Erosion', color: 'gold' },
    { timeMs: 21000, label: 'Phase 2', color: 'gold' },
    { timeMs: 41000, label: 'Split 2: Hands of Erosion and Eruption / Phase 3', color: 'gold' },
    { timeMs: 81000, label: 'Phase 4', color: 'gold' }
  ];
  for (const width of [1600, 280]) {
    const labels = layoutChartMarkerLabels(markers, 81000, 54, width, (label) => label.length * 6);
    for (const [index, label] of labels.entries()) {
      assert.equal(label.x, 54 + (markers[index].timeMs / 81000) * width);
      assert.ok(label.left >= 54);
      assert.ok(label.left + label.width <= 54 + width);
      for (const other of labels.slice(index + 1).filter((other) => other.lane === label.lane)) {
        assert.ok(label.left + label.width + 8 <= other.left);
      }
    }

    assert.notEqual(labels[1].lane, labels[2].lane);
  }
});

// Intermissions are downtime in the cumulative clock, not selectable damage phases or DPS disclosure entries.
test('intermissions preserve phase numbering and stay out of damage analysis controls', () => {
  const result = fixture();
  result.encounter.phases.splice(2, 0, {
    id: 'intermission-split',
    kind: 'intermission',
    start: 15,
    end: 18,
    playerDamage: 0,
    groupDamage: 0
  });
  result.encounter.phases[3].start = 18;
  const phases = encounterAnalysisPhases(result, definitions);
  assert.equal(phases[2].label, 'Intermission 1');
  assert.equal(phases[3].label, 'Phase 2');
  assert.ok(phases[2].overallDps < phases[1].overallDps);
  assert.deepEqual(
    encounterDpsSnapshots(phases).map((phase) => phase.label),
    ['Phase 1', 'Phase 2']
  );
  const container = inertContainer();
  mountTimeSeriesCharts(container, buildTimeSeries({ ...result, resolvedEvents: [] }, 250, { includeEffects: false }), {
    encounterPhases: phases
  });
  assert.doesNotMatch(container.innerHTML, /data-chart-phase="encounter-2"/);
  assert.match(container.innerHTML, /data-chart-phase="encounter-3"/);
});
