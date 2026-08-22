/**
 * Simulates every rotation-backed preset in the build manifests and reports
 * current DPS values that drift more than the preset regression tolerance.
 *
 * Dry-run usage: npm run benchmarks:compare
 * Commit usage: npm run benchmarks:compare -- --commit
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { captureSupportedBuildMetrics } from './capture-supported-build-metrics.mjs';

export const MAXIMUM_RELATIVE_ERROR = 0.01;
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** Keep the CLI and preset tests aligned on the 1% manifest DPS contract. */
export function findDpsMismatches(metrics, maximumRelativeError = MAXIMUM_RELATIVE_ERROR) {
  return metrics.flatMap((metric) => {
    const difference = metric.dps - metric.benchmarkDps;
    const relativeDifference = difference / metric.benchmarkDps;

    if (Math.abs(relativeDifference) <= maximumRelativeError) return [];

    return [
      {
        ...metric,
        difference,
        relativeDifference
      }
    ];
  });
}

function formatDps(value) {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatSignedDps(value) {
  const sign = value >= 0 ? '+' : '';

  return `${sign}${formatDps(value)}`;
}

function formatSignedPercent(value) {
  const sign = value >= 0 ? '+' : '';

  return `${sign}${(value * 100).toFixed(2)}%`;
}

export function printDpsComparison(metrics, maximumRelativeError = MAXIMUM_RELATIVE_ERROR) {
  const mismatches = findDpsMismatches(metrics, maximumRelativeError);
  const professionCount = new Set(metrics.map((metric) => metric.profession)).size;
  const tolerance = (maximumRelativeError * 100).toFixed(2);

  if (mismatches.length === 0) {
    console.log(
      `All ${metrics.length} rotation-backed builds across ${professionCount} manifests are within ${tolerance}% of benchmark DPS.`
    );

    return mismatches;
  }

  console.log(`Found ${mismatches.length} DPS mismatch(es) outside the ${tolerance}% tolerance:`);

  for (const mismatch of mismatches) {
    console.log(
      `- ${mismatch.profession} / ${mismatch.section} / ${mismatch.label}: ` +
        `benchmark ${formatDps(mismatch.benchmarkDps)}, current ${formatDps(mismatch.dps)}, ` +
        `difference ${formatSignedDps(mismatch.difference)} (${formatSignedPercent(mismatch.relativeDifference)})`
    );
  }

  console.log(
    `Compared ${metrics.length} rotation-backed builds across ${professionCount} manifests; ` +
      `${metrics.length - mismatches.length} are within tolerance.`
  );

  return mismatches;
}

function presetKey(section, preset) {
  return [section, preset.label, preset.build, preset.rotation].join('\0');
}

/** Replace manifest benchmark values only after every simulated preset has matched its source entry. */
export async function updateManifestBenchmarkDps(metrics, root = repoRoot) {
  const metricsByProfession = new Map();
  const pendingWrites = [];
  const skippedPresets = [];
  let updatedEntries = 0;
  let changedEntries = 0;

  for (const metric of metrics) {
    const professionMetrics = metricsByProfession.get(metric.profession) || [];

    professionMetrics.push(metric);
    metricsByProfession.set(metric.profession, professionMetrics);
  }

  for (const [profession, professionMetrics] of metricsByProfession) {
    const manifestPath = path.join(root, 'Builds', profession, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    const unmatchedMetrics = new Map(professionMetrics.map((metric) => [presetKey(metric.section, metric), metric]));

    for (const section of manifest) {
      for (const preset of section.presets) {
        const key = presetKey(section.section || '', preset);
        const metric = unmatchedMetrics.get(key);

        if (!metric) {
          if (preset.rotation) {
            throw new Error(
              `${profession}|${section.section || ''}|${preset.label} has a rotation but no simulation result.`
            );
          }

          if (!preset.rotation && Object.hasOwn(preset, 'benchmarkDps')) {
            skippedPresets.push({
              profession,
              section: section.section || '',
              label: preset.label
            });
          }

          continue;
        }

        if (!Number.isFinite(metric.dps) || metric.dps <= 0) {
          throw new TypeError(`${metric.id} produced invalid DPS: ${metric.dps}.`);
        }

        // Manifest benchmarks use whole DPS values so routine regeneration does not add meaningless floating-point noise.
        const nextBenchmarkDps = Math.round(metric.dps);

        if (!Object.is(preset.benchmarkDps, nextBenchmarkDps)) changedEntries += 1;

        preset.benchmarkDps = nextBenchmarkDps;
        updatedEntries += 1;
        unmatchedMetrics.delete(key);
      }
    }

    if (unmatchedMetrics.size > 0) {
      throw new Error(
        `${profession} manifest entries were not found for: ${[...unmatchedMetrics.values()]
          .map((metric) => metric.id)
          .join(', ')}.`
      );
    }

    pendingWrites.push({ manifestPath, contents: `${JSON.stringify(manifest, null, 2)}\n` });
  }

  await Promise.all(pendingWrites.map(({ manifestPath, contents }) => writeFile(manifestPath, contents, 'utf8')));

  return {
    updatedEntries,
    changedEntries,
    manifestsWritten: pendingWrites.length,
    skippedPresets
  };
}

export function parseMode(args) {
  const knownArguments = new Set(['--commit', '--dry', '--dry-run']);
  const unknownArguments = args.filter((argument) => !knownArguments.has(argument));

  if (unknownArguments.length > 0) {
    throw new TypeError(`Unknown argument(s): ${unknownArguments.join(', ')}.`);
  }

  const dryArguments = args.filter((argument) => argument === '--dry' || argument === '--dry-run');

  if (args.includes('--commit') && dryArguments.length > 0) {
    throw new TypeError('Choose either dry mode or --commit, not both.');
  }

  return args.includes('--commit') ? 'commit' : 'dry';
}

const isMain = process.argv[1] != null && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  const mode = parseMode(process.argv.slice(2));

  console.log(
    mode === 'commit'
      ? 'Commit mode: manifest benchmarkDps values will be updated.'
      : 'Dry mode: manifest files will not be changed.'
  );

  const metrics = await captureSupportedBuildMetrics();
  const mismatches = printDpsComparison(metrics);

  if (mode === 'commit') {
    const update = await updateManifestBenchmarkDps(metrics);

    console.log(
      `Updated ${update.updatedEntries} benchmarkDps entries (${update.changedEntries} changed) ` +
        `across ${update.manifestsWritten} manifests.`
    );

    if (update.skippedPresets.length > 0) {
      console.log(`${update.skippedPresets.length} preset(s) without rotations were left unchanged:`);

      for (const preset of update.skippedPresets) {
        console.log(`- ${preset.profession} / ${preset.section} / ${preset.label}`);
      }
    }
  } else if (mismatches.length > 0) {
    process.exitCode = 1;
  }
}
