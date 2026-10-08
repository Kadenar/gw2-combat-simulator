import assert from 'node:assert/strict';
import test from 'node:test';
import {
  patchBenchmarks,
  patchPercent,
  patchProfessionSummary,
  sortPatchBenchmarks
} from '#gw2/app/page/benchmark-patch-preview.js';
import { TARGET_HEALTH_BANDS } from '#gw2/app/results/summary-metrics.js';

const bands = Object.fromEntries(TARGET_HEALTH_BANDS.map(({ id }) => [id, { cumulative: null, phase: null }]));
const build = {
  profession: 'mesmer',
  professionName: 'Mesmer',
  specialization: 'Chronomancer',
  label: 'Power',
  build: 'power.json',
  rotation: 'rotation.json',
  benchmarkDps: 10000,
  patchPreview: { patchId: 'test', benchmarkDps: 11000, benchmarkDpsByHealth: bands }
};

// Mixed professions need both directions; highlights rank percentage impact rather than raw damage or table ordering.
test('profession summaries count outcomes and identify the largest gains and losses', () => {
  const rows = patchBenchmarks(
    [
      build,
      {
        ...build,
        label: 'Larger relative gain',
        benchmarkDps: 1000,
        patchPreview: { ...build.patchPreview, benchmarkDps: 1250 }
      },
      { ...build, label: 'Loss', patchPreview: { ...build.patchPreview, benchmarkDps: 8000 } },
      { ...build, label: 'Unchanged', patchPreview: { ...build.patchPreview, benchmarkDps: 10000 } }
    ],
    'test'
  );
  const summary = patchProfessionSummary(rows);
  assert.equal(summary.winners, 2);
  assert.equal(summary.losers, 1);
  assert.equal(summary.unchanged, 1);
  assert.equal(summary.largestGain.build.label, 'Larger relative gain');
  assert.equal(summary.largestGain.percent, 25);
  assert.equal(summary.largestLoss.build.label, 'Loss');
  assert.equal(summary.largestLoss.percent, -20);
  assert.deepEqual(patchProfessionSummary(rows.filter((row) => row.outcome === 'same')), {
    winners: 0,
    losers: 0,
    unchanged: 1,
    largestGain: undefined,
    largestLoss: undefined
  });
  assert.deepEqual(patchProfessionSummary([]), {
    winners: 0,
    losers: 0,
    unchanged: 0,
    largestGain: undefined,
    largestLoss: undefined
  });
});

// A missing or different-patch measurement must never manufacture an unchanged comparison.
test('preview eligibility requires active identity and valid paired damage measurements', () => {
  assert.deepEqual(patchBenchmarks([build], undefined), []);
  assert.deepEqual(patchBenchmarks([build], 'other'), []);
  for (const patchPreview of [
    undefined,
    null,
    {},
    { ...build.patchPreview, benchmarkDps: NaN },
    { ...build.patchPreview, benchmarkDps: -1 },
    { ...build.patchPreview, benchmarkDpsByHealth: {} }
  ]) {
    assert.deepEqual(patchBenchmarks([{ ...build, patchPreview }], 'test'), []);
  }

  assert.deepEqual(patchBenchmarks([{ ...build, rotation: undefined }], 'test'), []);
  assert.deepEqual(patchBenchmarks([{ ...build, benchmarkDps: 0 }], 'test'), []);
});

// Small changes and complete damage loss have explicit outcomes independently of the regression tolerance.
test('preview math classifies gains, losses, zero damage, and unchanged results', () => {
  for (const [dps, difference, percent, outcome] of [
    [11000, 1000, 10, 'up'],
    [9000, -1000, -10, 'down'],
    [0, -10000, -100, 'down'],
    [10000, 0, 0, 'same']
  ]) {
    const [row] = patchBenchmarks([{ ...build, patchPreview: { ...build.patchPreview, benchmarkDps: dps } }], 'test');
    assert.equal(row.difference, difference);
    assert.equal(row.percent, percent);
    assert.equal(row.outcome, outcome);
  }

  assert.equal(patchPercent(0.001), '+<0.01%');
  assert.equal(patchPercent(-0.001), '−<0.01%');
  assert.equal(patchPercent(0), '0.00%');
});

// Sorting ranks builds inside stable profession/specialization groups rather than separating related rows.
test('preview sort preserves group hierarchy and sorts changes within each specialization', () => {
  const rows = patchBenchmarks(
    [
      build,
      { ...build, label: 'Loss', patchPreview: { ...build.patchPreview, benchmarkDps: 8000 } },
      { ...build, specialization: 'Virtuoso', label: 'Virtuoso' },
      { ...build, profession: 'guardian', professionName: 'Guardian', label: 'Guardian' }
    ],
    'test'
  );
  assert.deepEqual(
    sortPatchBenchmarks(rows, 'change').map((row) => row.build.label),
    ['Guardian', 'Loss', 'Power', 'Virtuoso']
  );
  assert.deepEqual(
    sortPatchBenchmarks(rows, 'gains').map((row) => row.build.label),
    ['Guardian', 'Power', 'Loss', 'Virtuoso']
  );
  assert.deepEqual(
    sortPatchBenchmarks(rows, 'losses').map((row) => row.build.label),
    ['Guardian', 'Loss', 'Power', 'Virtuoso']
  );
});
