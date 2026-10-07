import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { TARGET_HEALTH_BANDS } from '#gw2/app/results/summary-metrics.js';
import {
  benchmarkColors,
  benchmarkScale,
  benchmarkApmScale,
  benchmarkComparisonAxis,
  hasBenchmarkApm,
  filterBenchmarks,
  readBenchmarks
} from '#gw2/app/page/benchmarks.js';

const profession = { id: 'mesmer', name: 'Mesmer' };
const rows = readBenchmarks(profession, [
  {
    section: 'Chronomancer',
    presets: [
      { label: 'Power', build: 'power.json', benchmarkDps: 41000, benchmarkApm: 42.4 },
      { label: 'Condition Quickness', build: 'condi.json', benchmarkDps: 32000, benchmarkApm: 0 },
      { label: 'Power old', build: 'old.json', benchmarkDps: 50000, upToDate: false },
      { label: 'Unknown', build: 'unknown.json' }
    ]
  }
]);
const filters = { professions: new Set(['mesmer']), query: '', damage: 'all', role: 'all', includeOutdated: false };

// Shades retain the supplied profession accent and stay stable when other professions or filters change.
test('benchmark colors shade profession accents and remain stable across catalog ordering and filters', () => {
  const catalog = Array.from({ length: 50 }, (_, index) => ({ ...rows[0], build: `${index}.json` }));
  const accents = new Map([
    ['mesmer', '#ad83df'],
    ['guardian', '#72c1d9']
  ]);
  const guardian = { ...rows[0], profession: 'guardian' };
  const colors = benchmarkColors(catalog, accents);
  const reordered = benchmarkColors([guardian, ...catalog].reverse(), accents);
  assert.equal(new Set(colors.values()).size, catalog.length);
  for (const row of filterBenchmarks(catalog, filters)) {
    assert.equal(colors.get(row), reordered.get(row));
    assert.match(colors.get(row), /^color-mix\(in srgb, #ad83df /);
  }

  assert.match(reordered.get(guardian), /^color-mix\(in srgb, #72c1d9 /);
});

// Keep filtering and graph math in Node; browsers only verify native control and layout behavior.
test('benchmark filters share a population, omit unavailable DPS, and explicitly include outdated builds', () => {
  assert.equal(rows.length, 3);
  assert.deepEqual(
    filterBenchmarks(rows, filters).map((row) => row.label),
    ['Power', 'Condition Quickness']
  );
  assert.equal(filterBenchmarks(rows, { ...filters, includeOutdated: true })[0].label, 'Power old');
  assert.equal(
    filterBenchmarks(rows, { ...filters, query: ' CHRONOMANCER ', damage: 'condi', role: 'quickness' })[0].label,
    'Condition Quickness'
  );
  assert.deepEqual(filterBenchmarks(rows, { ...filters, professions: new Set() }), []);
  assert.deepEqual(filterBenchmarks(rows, { ...filters, query: 'missing' }), []);
});

test('chart domains include all values and distinguish missing APM from zero', () => {
  assert.equal(benchmarkScale(rows), 50000);
  assert.equal(benchmarkApmScale(rows), 60);
  assert.equal(rows.filter(hasBenchmarkApm).length, 2);
  assert.equal(benchmarkScale([]), 10000);
  assert.equal(benchmarkApmScale([]), 20);
  assert.equal(hasBenchmarkApm({ ...rows[0], benchmarkApm: -1 }), false);
  assert.equal(hasBenchmarkApm({ ...rows[0], benchmarkApm: NaN }), false);
  assert.throws(() => readBenchmarks(profession, {}), /Invalid benchmark/);
  assert.throws(() => readBenchmarks(profession, [{ section: 'Core' }]), /Invalid benchmark/);
});

// Comparison curves and scatter points use padded data bounds rather than the zero baseline required by bars.
test('comparison axes enclose narrow, broad, constant, and zero ranges with evenly spaced readable ticks', () => {
  for (const [values, padding] of [
    [[31000, 47000, 59000], 50],
    [[42000, 42500], 50],
    [[40000], 50],
    [[0], 50],
    [[], 50],
    [[0, 45000], 50],
    [[42, 80, 151], 1],
    [[79.8, 80.1], 1],
    [[50], 1],
    [[0], 1],
    [[], 1]
  ]) {
    const { min, max, ticks } = benchmarkComparisonAxis(values, padding);
    assert.ok(max > min);
    assert.ok(min >= 0);
    assert.ok(values.every((value) => value >= min && value <= max));
    assert.ok(ticks.length >= 4 && ticks.length <= 12);
    assert.equal(ticks[0], max);
    assert.ok(Math.abs(ticks.at(-1) - min) < 1e-8);
    const step = ticks[0] - ticks[1];
    assert.ok(ticks.slice(1).every((tick, index) => Math.abs(ticks[index] - tick - step) < 1e-8));
  }

  const narrow = benchmarkComparisonAxis([42000, 42500], 50);
  assert.ok(narrow.min > 40000);
  assert.ok(narrow.max < 44000);
  const apm = benchmarkComparisonAxis([42, 80, 151], 1);
  assert.ok(apm.min > 0 && apm.min < 42);
  assert.ok(apm.max > 151 && apm.max <= 180);
});

test('every rotation-backed manifest entry supplies APM and explicit health-band measurements', async () => {
  for (const id of [
    'elementalist',
    'engineer',
    'guardian',
    'mesmer',
    'necromancer',
    'ranger',
    'revenant',
    'thief',
    'warrior'
  ]) {
    const sections = JSON.parse(
      await readFile(new URL(`../../../../data/gw2/builds/${id}/manifest.json`, import.meta.url), 'utf8')
    );
    for (const { presets } of sections) {
      for (const preset of presets.filter((entry) => entry.rotation)) {
        assert.ok(Number.isFinite(preset.benchmarkApm) && preset.benchmarkApm >= 0, `${id}: ${preset.label}`);
        assert.deepEqual(
          Object.keys(preset.benchmarkDpsByHealth),
          TARGET_HEALTH_BANDS.map((band) => band.id)
        );
        for (const band of Object.values(preset.benchmarkDpsByHealth)) {
          assert.deepEqual(Object.keys(band), ['cumulative', 'phase']);
          for (const value of Object.values(band)) {
            assert.ok(value === null || (Number.isFinite(value) && value >= 0), `${id}: ${preset.label}`);
          }
        }
      }
    }
  }
});
