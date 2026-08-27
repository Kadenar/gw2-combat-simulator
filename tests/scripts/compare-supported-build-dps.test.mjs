import assert from 'node:assert/strict';
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
  updateManifestBenchmarkDps
} from '../../scripts/analysis/compare-supported-build-dps.mjs';
import { parseGameOption } from '../../scripts/lib/game-data.mjs';

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

  assert.deepEqual(output, ['All 1 rotation-backed builds across 1 manifests are within 100 DPS of benchmark DPS.']);
});

test('commit mode writes simulated DPS to matching manifest entries', async (context) => {
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

  const update = await updateManifestBenchmarkDps(
    [
      {
        id: 'mesmer|Chronomancer|Power',
        profession: 'mesmer',
        section: 'Chronomancer',
        label: 'Power',
        build: 'data/gw2/builds/mesmer/power.json',
        rotation: 'data/gw2/rotations/mesmer/power.json',
        dps: 40_123.5
      }
    ],
    root
  );
  const [section] = JSON.parse(await readFile(manifestPath, 'utf8'));

  assert.equal(section.presets[0].benchmarkDps, 40_124);
  assert.equal(section.presets[1].benchmarkDps, 30_000);
  assert.deepEqual(update, {
    updatedEntries: 1,
    changedEntries: 1,
    manifestsWritten: 1,
    skippedPresets: [
      {
        profession: 'mesmer',
        section: 'Chronomancer',
        label: 'No rotation'
      }
    ]
  });
});
