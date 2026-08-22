import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  findDpsMismatches,
  MAXIMUM_RELATIVE_ERROR,
  parseMode,
  updateManifestBenchmarkDps
} from '../../scripts/analysis/compare-supported-build-dps.mjs';

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

test('mode parsing defaults to dry mode and requires an explicit commit', () => {
  assert.equal(parseMode([]), 'dry');
  assert.equal(parseMode(['--dry']), 'dry');
  assert.equal(parseMode(['--dry-run']), 'dry');
  assert.equal(parseMode(['--commit']), 'commit');
  assert.throws(() => parseMode(['--commit', '--dry']), /either dry mode or --commit/);
  assert.throws(() => parseMode(['--unknown']), /Unknown argument/);
});

test('commit mode writes simulated DPS to matching manifest entries', async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), 'gw2-benchmark-update-'));
  const manifestDirectory = path.join(root, 'Builds', 'mesmer');
  const manifestPath = path.join(manifestDirectory, 'manifest.json');

  context.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(manifestDirectory, { recursive: true });
  await writeFile(
    manifestPath,
    `${JSON.stringify(
      [
        {
          section: 'Chronomancer',
          presets: [
            {
              label: 'Power',
              build: 'Builds/mesmer/power.json',
              rotation: 'Rotations/mesmer/power.json',
              benchmarkDps: 40_000
            },
            {
              label: 'No rotation',
              build: 'Builds/mesmer/no-rotation.json',
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
        build: 'Builds/mesmer/power.json',
        rotation: 'Rotations/mesmer/power.json',
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
