import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  findDpsMismatches,
  MAXIMUM_ABSOLUTE_DPS_ERROR,
  MAXIMUM_RELATIVE_ERROR,
  parseMaximumAbsoluteDpsError,
  parseMode,
  printDpsComparison,
  updateManifestBenchmarks
} from '../../scripts/analysis/compare-supported-build-dps.mjs';
import { parseGameOption } from '../../scripts/lib/game-data.mjs';
import { simulateBenchmarkPreset } from '../../scripts/analysis/capture-supported-build-metrics.mjs';

// Patch selection must precede attributes and config, and mutations from one run cannot contaminate its pair.
test('capture selects patch catalogs before recalculating independent benchmark state', () => {
  const catalogs = Object.fromEntries(
    ['current', 'preview'].map((id) => [
      id,
      {
        skillsByName: new Map([[id, id]]),
        skillsById: new Map([[1, id]])
      }
    ])
  );
  const source = { assumptions: { might: 25 } };
  const rotation = { rotation: [{ skillId: 1 }] };
  const adapter = {
    profession: { catalogFor: (id) => catalogs[id] },
    toApplicationBuild: (build) => build,
    recalculate(app) {
      assert.equal(app.activeCatalog, catalogs[app.patchId]);
      assert.equal(app.skillById.get(1), app.patchId);
      assert.equal(app.skillByName.get(app.patchId), app.patchId);
      assert.equal(app.build.assumptions.might, 25);
      app.attributeData = app.patchId === 'current' ? 100 : 200;
      app.build.assumptions.might = 0;
    },
    simulationConfig: (app) => ({ patchId: app.patchId, power: app.attributeData }),
    simulateBuild(commands, config) {
      commands.push({ skillId: 2 });
      return config;
    }
  };
  assert.deepEqual(simulateBenchmarkPreset(adapter, source, rotation).result, { patchId: 'current', power: 100 });
  assert.deepEqual(simulateBenchmarkPreset(adapter, source, rotation, 'preview').result, {
    patchId: 'preview',
    power: 200
  });
  assert.equal(source.assumptions.might, 25);
  assert.deepEqual(rotation, { rotation: [{ skillId: 1 }] });
});

test('analysis modules stay inert on import and execute their CLI when launched directly', () => {
  // Help and invalid arguments exercise entry points without reading logs or changing benchmark manifests.
  for (const [script, args, status, output] of [
    ['analyze-overload-fire.mjs', ['--help'], 0, /Usage: node/],
    ['compare-supported-build-dps.mjs', ['--unknown'], 1, /Unknown argument/],
    ['capture-supported-build-metrics.mjs', ['unknown'], 1, /Unknown professions/]
  ]) {
    const entry = new URL(`../../scripts/analysis/${script}`, import.meta.url);
    const imported = spawnSync(
      process.execPath,
      ['--input-type=module', '--eval', `await import(${JSON.stringify(entry.href)});`],
      {
        encoding: 'utf8'
      }
    );
    assert.equal(imported.status, 0, imported.stderr);
    assert.equal(imported.stdout, '');
    const invoked = spawnSync(
      process.execPath,
      [path.resolve(import.meta.dirname, '../../scripts/analysis', script), ...args],
      {
        encoding: 'utf8'
      }
    );
    assert.equal(invoked.status, status, invoked.stderr);
    assert.match(invoked.stdout + invoked.stderr, output);
  }
});

test('DPS comparison reports only manifest builds outside the 1% tolerance', () => {
  const metrics = [
    { id: 'within-positive', benchmarkDps: 40_000, dps: 40_400 },
    { id: 'within-negative', benchmarkDps: 40_000, dps: 39_600 },
    { id: 'above', benchmarkDps: 40_000, dps: 40_401 },
    { id: 'below', benchmarkDps: 40_000, dps: 39_599 }
  ];

  const mismatches = findDpsMismatches(metrics);

  assert.equal(MAXIMUM_RELATIVE_ERROR, 0.01);
  assert.deepEqual(
    mismatches.map(({ id, difference, relativeDifference }) => ({ id, difference, relativeDifference })),
    [
      { id: 'above', difference: 401, relativeDifference: 0.010025 },
      { id: 'below', difference: -401, relativeDifference: -0.010025 }
    ]
  );
});

test('absolute DPS comparison reports only builds more than 100 DPS from the manifest value', () => {
  const metrics = [
    { id: 'within-positive', benchmarkDps: 40_000, dps: 40_100 },
    { id: 'within-negative', benchmarkDps: 40_000, dps: 39_900 },
    { id: 'above', benchmarkDps: 40_000, dps: 40_101 },
    { id: 'below', benchmarkDps: 40_000, dps: 39_899 }
  ];

  const mismatches = findDpsMismatches(metrics, MAXIMUM_RELATIVE_ERROR, MAXIMUM_ABSOLUTE_DPS_ERROR);

  assert.equal(MAXIMUM_ABSOLUTE_DPS_ERROR, 100);
  assert.deepEqual(
    mismatches.map(({ id, difference }) => ({ id, difference })),
    [
      { id: 'above', difference: 101 },
      { id: 'below', difference: -101 }
    ]
  );
});

test('mode parsing defaults to dry mode and requires an explicit commit', () => {
  assert.equal(parseMode([]), 'dry');
  assert.equal(parseMode(['--dry']), 'dry');
  assert.equal(parseMode(['--dry-run']), 'dry');
  assert.equal(parseMode(['--absolute-dps']), 'dry');
  assert.equal(parseMode(['--commit']), 'commit');
  assert.throws(() => parseMode(['--commit', '--dry']), /either dry mode or --commit/);
  assert.throws(() => parseMode(['--unknown']), /Unknown argument/);
});

test('game option parsing defaults to GW2 and removes the shared option', () => {
  assert.deepEqual(parseGameOption(['--commit']), { gameId: 'gw2', args: ['--commit'] });
  assert.deepEqual(parseGameOption(['--game=gw2', '--dry']), { gameId: 'gw2', args: ['--dry'] });
  assert.throws(() => parseGameOption(['--game=gw2', '--game=fake']), /only once/);
});

test('absolute DPS tolerance requires an explicit flag', () => {
  assert.equal(parseMaximumAbsoluteDpsError([]), null);
  assert.equal(parseMaximumAbsoluteDpsError(['--absolute-dps']), 100);
});

test('absolute DPS comparison output identifies the fixed tolerance', (context) => {
  const output = [];

  context.mock.method(console, 'log', (message) => output.push(message));
  printDpsComparison(
    [{ profession: 'mesmer', benchmarkDps: 40_000, dps: 40_100 }],
    MAXIMUM_RELATIVE_ERROR,
    MAXIMUM_ABSOLUTE_DPS_ERROR
  );

  assert.ok(output.some((line) => line.includes('within 100 DPS of benchmark DPS.')));
});

test('commit mode writes simulated DPS and APM to matching manifest entries', async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), 'gw2-benchmark-update-'));
  const manifestDirectory = path.join(root, 'data', 'gw2', 'builds', 'mesmer');
  const manifestPath = path.join(manifestDirectory, 'manifest.json');

  context.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(manifestDirectory, { recursive: true });
  await writeFile(
    path.join(root, 'data', 'games.json'),
    JSON.stringify({ games: [{ id: 'gw2', runtimeData: [{ kind: 'builds', source: 'data/gw2/builds' }] }] }),
    'utf8'
  );
  await writeFile(
    manifestPath,
    `${JSON.stringify(
      [
        {
          section: 'Chronomancer',
          presets: [
            {
              label: 'Power',
              build: 'data/gw2/builds/mesmer/power.json',
              rotation: 'data/gw2/rotations/mesmer/power.json',
              benchmarkDps: 40_000
            },
            {
              label: 'No rotation',
              build: 'data/gw2/builds/mesmer/no-rotation.json',
              benchmarkDps: 30_000
            }
          ]
        }
      ],
      null,
      2
    )}\n`,
    'utf8'
  );

  const update = await updateManifestBenchmarks(
    [
      {
        id: 'mesmer|Chronomancer|Power',
        patchId: 'current',
        profession: 'mesmer',
        section: 'Chronomancer',
        label: 'Power',
        build: 'data/gw2/builds/mesmer/power.json',
        rotation: 'data/gw2/rotations/mesmer/power.json',
        dps: 40_123.5,
        apm: 42.36,
        dpsByHealth: {
          '100-80': { cumulative: 45000.6, phase: 45000.6 },
          '80-60': { cumulative: 42500.8, phase: 40000.2 },
          '60-40': { cumulative: 28000, phase: 0 },
          '40-20': { cumulative: null, phase: null },
          '20-0': { cumulative: 40123.5, phase: 40123.5 }
        }
      }
    ],
    root
  );
  const [section] = JSON.parse(await readFile(manifestPath, 'utf8'));

  assert.equal(section.presets[0].benchmarkDps, 40_124);
  assert.equal(section.presets[0].benchmarkApm, 42.4);
  assert.deepEqual(section.presets[0].benchmarkDpsByHealth, {
    '100-80': { cumulative: 45001, phase: 45001 },
    '80-60': { cumulative: 42501, phase: 40000 },
    '60-40': { cumulative: 28000, phase: 0 },
    '40-20': { cumulative: null, phase: null },
    '20-0': { cumulative: 40124, phase: 40124 }
  });
  assert.equal(section.presets[1].benchmarkDps, 30_000);
  assert.equal(section.presets[1].benchmarkApm, undefined);
  assert.deepEqual(update, {
    updatedEntries: 1,
    changedEntries: 1,
    manifestsWritten: 1,
    previewUpdatedEntries: 0,
    previewRemovedEntries: 0,
    skippedPresets: [
      {
        profession: 'mesmer',
        section: 'Chronomancer',
        label: 'No rotation'
      }
    ]
  });

  // Invalid simulated APM must leave the complete manifest untouched, even when DPS is otherwise valid.
  const saved = await readFile(manifestPath, 'utf8');
  const metric = {
    ...section.presets[0],
    id: 'mesmer|Chronomancer|Power',
    patchId: 'current',
    profession: 'mesmer',
    section: 'Chronomancer',
    dps: 40124,
    dpsByHealth: section.presets[0].benchmarkDpsByHealth
  };
  for (const apm of [undefined, null, NaN, Infinity, -1]) {
    await assert.rejects(updateManifestBenchmarks([{ ...metric, apm }], root), /invalid APM/);
    assert.equal(await readFile(manifestPath, 'utf8'), saved);
  }

  for (const dpsByHealth of [
    undefined,
    {},
    { ...metric.dpsByHealth, '100-80': -1 },
    { ...metric.dpsByHealth, '20-0': undefined },
    { ...metric.dpsByHealth, '80-60': { cumulative: Infinity, phase: 40000 } },
    { ...metric.dpsByHealth, '80-60': { cumulative: 42501, phase: -1 } },
    { ...metric.dpsByHealth, '80-60': { cumulative: 42501 } }
  ]) {
    await assert.rejects(updateManifestBenchmarks([{ ...metric, apm: 42.4, dpsByHealth }], root), /invalid/);
    assert.equal(await readFile(manifestPath, 'utf8'), saved);
  }

  // A zero-input execution is valid; changing APM alone still counts as a changed benchmark.
  const apmOnly = await updateManifestBenchmarks([{ ...metric, apm: 0 }], root);
  assert.equal(apmOnly.changedEntries, 1);
  assert.equal(JSON.parse(await readFile(manifestPath, 'utf8'))[0].presets[0].benchmarkApm, 0);
  assert.equal((await updateManifestBenchmarks([{ ...metric, apm: 0 }], root)).changedEntries, 0);
  const bandOnly = await updateManifestBenchmarks(
    [{ ...metric, apm: 0, dpsByHealth: { ...metric.dpsByHealth, '40-20': { cumulative: 41000, phase: 42000 } } }],
    root
  );
  assert.equal(bandOnly.changedEntries, 1);
});

// Reconciliation replaces complete preview records and sweeps entries outside the simulated population.
test('preview commits, dry runs, validation failures, and removal reconcile every manifest', async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), 'gw2-preview-update-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const builds = path.join(root, 'data/gw2/builds');
  await mkdir(path.join(builds, 'mesmer'), { recursive: true });
  await mkdir(path.join(builds, 'guardian'), { recursive: true });
  await writeFile(
    path.join(root, 'data/games.json'),
    JSON.stringify({ games: [{ id: 'gw2', runtimeData: [{ kind: 'builds', source: 'data/gw2/builds' }] }] })
  );
  const mesmerPath = path.join(builds, 'mesmer/manifest.json');
  const guardianPath = path.join(builds, 'guardian/manifest.json');
  const bands = Object.fromEntries(
    ['100-80', '80-60', '60-40', '40-20', '20-0'].map((id) => [id, { cumulative: null, phase: null }])
  );
  const metric = {
    id: 'test',
    profession: 'mesmer',
    section: 'Chronomancer',
    label: 'Power',
    build: 'build.json',
    rotation: 'rotation.json',
    patchId: 'current',
    dps: 10000,
    apm: 40,
    dpsByHealth: bands
  };
  const stale = { patchId: 'old', benchmarkDps: 12000, benchmarkDpsByHealth: bands };
  await writeFile(
    mesmerPath,
    JSON.stringify([
      {
        section: 'Chronomancer',
        presets: [{ label: metric.label, build: metric.build, rotation: metric.rotation, patchPreview: stale }]
      }
    ])
  );
  await writeFile(
    guardianPath,
    JSON.stringify([
      {
        section: 'Core',
        presets: [{ label: 'No rotation', build: 'other.json', upToDate: false, patchPreview: stale }]
      }
    ])
  );
  const before = await Promise.all([readFile(mesmerPath, 'utf8'), readFile(guardianPath, 'utf8')]);
  const preview = { id: 'preview' };
  // Simulator diagnostics remain available to the CLI without becoming saved preview metadata.
  const previewMetric = { ...metric, patchId: preview.id, dps: 0, warnings: ['Fixture rotation needs updating.'] };
  delete previewMetric.apm;
  const options = { preview, previewMetrics: [previewMetric] };
  const dry = await updateManifestBenchmarks([metric], root, 'gw2', { ...options, commit: false });
  assert.equal(dry.previewUpdatedEntries, 1);
  assert.equal(dry.previewRemovedEntries, 1);
  assert.equal(dry.manifestsWritten, 0);
  assert.deepEqual(await Promise.all([readFile(mesmerPath, 'utf8'), readFile(guardianPath, 'utf8')]), before);
  for (const invalid of [
    [],
    [{ ...previewMetric, patchId: 'wrong' }],
    [{ ...previewMetric, dps: NaN }],
    [previewMetric, previewMetric]
  ]) {
    await assert.rejects(updateManifestBenchmarks([metric], root, 'gw2', { preview, previewMetrics: invalid }));
    assert.deepEqual(await Promise.all([readFile(mesmerPath, 'utf8'), readFile(guardianPath, 'utf8')]), before);
  }

  await assert.rejects(updateManifestBenchmarks([metric, metric], root, 'gw2', options), /Duplicate/);
  await updateManifestBenchmarks([metric], root, 'gw2', options);
  const saved = JSON.parse(await readFile(mesmerPath, 'utf8'))[0].presets[0];
  assert.deepEqual(saved.patchPreview, { patchId: 'preview', benchmarkDps: 0, benchmarkDpsByHealth: bands });
  assert.equal(saved.benchmarkDps, 10000);
  assert.equal(saved.benchmarkApm, 40);
  assert.equal(Object.hasOwn(JSON.parse(await readFile(guardianPath, 'utf8'))[0].presets[0], 'patchPreview'), false);
  assert.equal((await updateManifestBenchmarks([metric], root, 'gw2', options)).manifestsWritten, 0);
  await updateManifestBenchmarks([metric], root, 'gw2', { preview, previewMetrics: [{ ...previewMetric, dps: 9000 }] });
  assert.equal(JSON.parse(await readFile(mesmerPath, 'utf8'))[0].presets[0].patchPreview.benchmarkDps, 9000);
  const cleanup = await updateManifestBenchmarks([metric], root);
  assert.equal(cleanup.previewRemovedEntries, 1);
  assert.equal(Object.hasOwn(JSON.parse(await readFile(mesmerPath, 'utf8'))[0].presets[0], 'patchPreview'), false);
  // Cleanup also works when there are no simulated builds anywhere in the catalog.
  await writeFile(mesmerPath, '[]');
  await writeFile(
    guardianPath,
    JSON.stringify([{ section: 'Core', presets: [{ label: 'No rotation', build: 'other.json', patchPreview: stale }] }])
  );
  assert.equal((await updateManifestBenchmarks([], root)).previewRemovedEntries, 1);
});
