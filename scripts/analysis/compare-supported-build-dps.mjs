/**
 * Simulates every rotation-backed preset in the build manifests and reports
 * current DPS values that drift more than the preset regression tolerance.
 *
 * Dry-run usage: npm run benchmarks:compare
 * Absolute-tolerance usage: npm run benchmarks:compare -- --absolute-dps
 * Commit usage: npm run benchmarks:compare -- --commit
 */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { format, resolveConfig } from 'prettier';
import { activePatchPreview } from '#gw2/integrations/patches/active-preview.js';
import { findPendingPatchBenchmark } from '#gw2/app/page/benchmark-patch-preview.js';

import { captureSupportedBuildMetrics } from './capture-supported-build-metrics.mjs';
import { parseGameOption, resolveGameData } from '../lib/game-data.mjs';
import { TARGET_HEALTH_BANDS } from '#gw2/app/results/summary-metrics.js';

export const MAXIMUM_RELATIVE_ERROR = 0.01;
export const MAXIMUM_ABSOLUTE_DPS_ERROR = 100;
const repoRoot = path.resolve(import.meta.dirname, '../..');

/** Keep the default 1% contract while allowing the CLI to opt into a fixed-DPS regression threshold. */
export function findDpsMismatches(
  metrics,
  maximumRelativeError = MAXIMUM_RELATIVE_ERROR,
  maximumAbsoluteDpsError = null
) {
  return metrics.flatMap((metric) => {
    const difference = metric.dps - metric.benchmarkDps;
    const relativeDifference = difference / metric.benchmarkDps;
    const isWithinTolerance =
      maximumAbsoluteDpsError == null
        ? Math.abs(relativeDifference) <= maximumRelativeError
        : Math.abs(difference) <= maximumAbsoluteDpsError;

    if (isWithinTolerance) return [];

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

/** Align numeric columns and group build labels so repeated identities do not crowd the comparison. */
function printComparisonTable(rows, baselineLabel, resultLabel) {
  const headers = ['Build', baselineLabel, resultLabel, 'Change DPS', 'Change %'];
  const cells = rows.map((row) => [
    row.label,
    formatDps(row.baseline),
    formatDps(row.dps),
    formatSignedDps(row.difference),
    formatSignedPercent(row.relativeDifference)
  ]);
  const widths = headers.map((header, index) => Math.max(header.length, ...cells.map((row) => row[index].length)));
  const line = (values) =>
    '  ' +
    values
      .map((value, index) => (index === 0 ? value.padEnd(widths[index]) : value.padStart(widths[index])))
      .join('  ');
  const groups = Map.groupBy(
    rows.map((row, index) => ({ ...row, cells: cells[index] })),
    (row) => `${row.profession} / ${row.section}`
  );
  for (const [group, entries] of groups) {
    console.log(`\n  ${group}`);
    console.log(line(headers));
    console.log(line(widths.map((width) => '-'.repeat(width))));
    for (const entry of entries) console.log(line(entry.cells));
  }
}

/** Keep saved-benchmark drift separate from balance changes, using the selected regression tolerance. */
export function printDpsComparison(
  metrics,
  maximumRelativeError = MAXIMUM_RELATIVE_ERROR,
  maximumAbsoluteDpsError = null
) {
  const mismatches = findDpsMismatches(metrics, maximumRelativeError, maximumAbsoluteDpsError);
  const professionCount = new Set(metrics.map((metric) => metric.profession)).size;
  const tolerance =
    maximumAbsoluteDpsError == null ? `${(maximumRelativeError * 100).toFixed(2)}%` : `${maximumAbsoluteDpsError} DPS`;

  console.log('\nLIVE BENCHMARK CHECK');
  if (mismatches.length === 0) {
    console.log(
      `All ${metrics.length} rotation-backed builds across ${professionCount} manifests are within ${tolerance} of benchmark DPS.`
    );

    return mismatches;
  }

  console.log(`Found ${mismatches.length} DPS mismatch(es) outside the ${tolerance} tolerance:`);

  printComparisonTable(
    mismatches.map((metric) => ({ ...metric, baseline: metric.benchmarkDps })),
    'Saved DPS',
    'Live DPS'
  );

  console.log(
    `\nCompared ${metrics.length} rotation-backed builds across ${professionCount} manifests; ` +
      `${metrics.length - mismatches.length} are within tolerance.`
  );

  return mismatches;
}

/** Compare paired simulations, omit unchanged rows, and label pending reworks instead of reporting misleading deltas. */
export function printPatchPreviewComparison(metrics, previewMetrics, preview) {
  const liveByKey = indexMetrics(metrics);
  const changes = [];
  const pending = [];
  let unchanged = 0;
  for (const metric of previewMetrics) {
    const live = liveByKey.get([metric.profession, presetKey(metric.section, metric)].join('\0'));
    if (!live) throw new Error(metric.id + ' has no matching live result.');
    const rework = findPendingPatchBenchmark({ ...metric, specialization: metric.section }, preview);
    if (rework) {
      pending.push({ ...metric, reason: rework.reason });
      continue;
    }

    // Use displayed precision to avoid filling the report with invisible floating-point differences.
    if (formatDps(metric.dps) === formatDps(live.dps)) {
      unchanged += 1;
      continue;
    }

    const difference = metric.dps - live.dps;
    changes.push({ ...metric, baseline: live.dps, difference, relativeDifference: difference / live.dps });
  }

  console.log(`\nBALANCE PREVIEW: ${preview.label} (${preview.id})`);
  console.log(
    'Preview vs live simulation using the same saved rotations; changes do not affect the live benchmark check.'
  );
  const increased = changes.filter((metric) => metric.difference > 0).length;
  console.log(
    `${increased} increased | ${changes.length - increased} decreased | ${unchanged} unchanged | ${pending.length} pending`
  );
  if (unchanged) console.log('Unchanged builds omitted (DPS rounded to 2 decimals).');
  if (changes.length) printComparisonTable(changes, 'Live DPS', 'Preview DPS');
  if (pending.length) {
    console.log('\n  Pending reworks (preview DPS not comparable)');
    for (const metric of pending) {
      console.log(`  - ${metric.profession} / ${metric.section} / ${metric.label}`);
      console.log(`    ${metric.reason}`);
    }
  }
}

function presetKey(section, preset) {
  return [section, preset.label, preset.build, preset.rotation].join('\0');
}

/** Validate and round both target-health measurements without manufacturing values for missing bands. */
function benchmarkDamage(metric, preview = false) {
  if (!Number.isFinite(metric.dps) || (preview ? metric.dps < 0 : metric.dps <= 0)) {
    throw new TypeError(metric.id + ' produced invalid DPS: ' + metric.dps + '.');
  }

  if (!metric.dpsByHealth || Object.keys(metric.dpsByHealth).length !== TARGET_HEALTH_BANDS.length) {
    throw new TypeError(metric.id + ' produced invalid target-health DPS bands.');
  }

  const benchmarkDpsByHealth = Object.fromEntries(
    TARGET_HEALTH_BANDS.map(({ id }) => {
      const band = metric.dpsByHealth[id];
      if (!band || Object.keys(band).length !== 2)
        throw new TypeError(metric.id + ' produced invalid DPS for ' + id + '%.');
      return [
        id,
        Object.fromEntries(
          ['cumulative', 'phase'].map((mode) => {
            const value = band[mode];
            if (value !== null && (!Number.isFinite(value) || value < 0))
              throw new TypeError(metric.id + ' produced invalid ' + mode + ' DPS for ' + id + '%.');
            return [mode, value === null ? null : Math.round(value)];
          })
        )
      ];
    })
  );
  return { benchmarkDps: Math.round(metric.dps), benchmarkDpsByHealth };
}

/** Index exact source identities, rejecting duplicates before any manifest can be changed. */
function indexMetrics(metrics) {
  const indexed = new Map();
  for (const metric of metrics) {
    const key = [metric.profession, presetKey(metric.section, metric)].join('\0');
    if (indexed.has(key)) throw new Error('Duplicate simulation result: ' + metric.id);
    indexed.set(key, metric);
  }

  return indexed;
}

/** Reconcile every manifest, including entries without simulations, after validating complete live/preview pairs. */
export async function updateManifestBenchmarks(
  metrics,
  root = repoRoot,
  gameId = 'gw2',
  { preview = null, previewMetrics = [], commit = true } = {}
) {
  const data = resolveGameData(root, gameId);
  const liveResults = indexMetrics(metrics);
  const previewResults = indexMetrics(previewMetrics);
  if (!preview && previewResults.size) throw new Error('Preview results require an active preview.');
  const pendingWrites = [];
  const skippedPresets = [];
  const seen = new Set();
  let updatedEntries = 0;
  let changedEntries = 0;
  let previewUpdatedEntries = 0;
  let previewRemovedEntries = 0;
  const professions = (await readdir(data.builds, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  for (const profession of professions) {
    const manifestPath = path.join(data.builds, profession, 'manifest.json');
    const original = await readFile(manifestPath, 'utf8');
    const manifest = JSON.parse(original);
    const previous = JSON.stringify(manifest);
    for (const section of manifest) {
      for (const preset of section.presets) {
        const key = [profession, presetKey(section.section || '', preset)].join('\0');
        if (seen.has(key)) throw new Error('Duplicate manifest entry: ' + key);
        seen.add(key);
        const before = JSON.stringify(preset);
        if (!preview || !preset.rotation) {
          if (Object.hasOwn(preset, 'patchPreview')) previewRemovedEntries += 1;
          delete preset.patchPreview;
        }

        if (!preset.rotation) {
          if (Object.hasOwn(preset, 'benchmarkDps'))
            skippedPresets.push({ profession, section: section.section || '', label: preset.label });
          if (before !== JSON.stringify(preset)) changedEntries += 1;
          continue;
        }

        const metric = liveResults.get(key);
        if (!metric)
          throw new Error(
            profession + '|' + section.section + '|' + preset.label + ' has a rotation but no simulation result.'
          );
        if (!Number.isFinite(metric.apm) || metric.apm < 0)
          throw new TypeError(metric.id + ' produced invalid APM: ' + metric.apm + '.');
        if (metric.patchId !== 'current') throw new Error(metric.id + ' is not a live result.');
        Object.assign(preset, benchmarkDamage(metric), { benchmarkApm: Math.round(metric.apm * 10) / 10 });
        liveResults.delete(key);
        if (preview) {
          const previewMetric = previewResults.get(key);
          if (!previewMetric || previewMetric.patchId !== preview.id)
            throw new Error(metric.id + ' has no matching preview result.');
          // Persist only preview measurements; pending reworks are declared by the active patch.
          const nextPreview = {
            patchId: preview.id,
            ...benchmarkDamage(previewMetric, true)
          };
          if (JSON.stringify(preset.patchPreview) !== JSON.stringify(nextPreview)) previewUpdatedEntries += 1;
          preset.patchPreview = nextPreview;
          previewResults.delete(key);
        }

        if (before !== JSON.stringify(preset)) changedEntries += 1;
        updatedEntries += 1;
      }
    }

    if (previous !== JSON.stringify(manifest)) {
      const options = await resolveConfig(manifestPath);
      pendingWrites.push({
        manifestPath,
        contents: await format(JSON.stringify(manifest), { ...options, parser: 'json' })
      });
    }
  }

  if (liveResults.size || previewResults.size)
    throw new Error('Manifest entries were not found for simulation results.');
  if (commit)
    await Promise.all(pendingWrites.map(({ manifestPath, contents }) => writeFile(manifestPath, contents, 'utf8')));
  return {
    updatedEntries,
    changedEntries,
    manifestsWritten: commit ? pendingWrites.length : 0,
    previewUpdatedEntries,
    previewRemovedEntries,
    skippedPresets
  };
}

export function parseMode(args) {
  const knownArguments = new Set(['--commit', '--dry', '--dry-run', '--absolute-dps']);
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

/** Select the fixed 100-DPS threshold only when the caller explicitly requests it. */
export function parseMaximumAbsoluteDpsError(args) {
  parseMode(args);

  return args.includes('--absolute-dps') ? MAXIMUM_ABSOLUTE_DPS_ERROR : null;
}

// Keep imports inert; only an explicit CLI invocation can run comparisons or commit manifest updates.
if (import.meta.main) {
  const { gameId, args } = parseGameOption(process.argv.slice(2));
  const mode = parseMode(args);
  const maximumAbsoluteDpsError = parseMaximumAbsoluteDpsError(args);

  console.log(
    mode === 'commit'
      ? 'Commit mode: manifest benchmarkDps, benchmarkApm, and benchmarkDpsByHealth values will be updated.'
      : 'Dry mode: manifest files will not be changed.'
  );

  // Announce each simulation pass so an active preview explains the additional capture time.
  console.log('Simulating live builds...');
  const metrics = await captureSupportedBuildMetrics(undefined, { gameId });
  let previewMetrics = [];
  if (activePatchPreview) {
    console.log(`Simulating balance preview: ${activePatchPreview.label} (${activePatchPreview.id})...`);
    previewMetrics = await captureSupportedBuildMetrics(undefined, { gameId, patchId: activePatchPreview.id });
  }

  const mismatches = printDpsComparison(metrics, MAXIMUM_RELATIVE_ERROR, maximumAbsoluteDpsError);
  if (activePatchPreview) printPatchPreviewComparison(metrics, previewMetrics, activePatchPreview);

  // Group diagnostics by patch and preset while retaining every warning beside the completed comparisons.
  const warnedMetrics = [...metrics, ...previewMetrics].filter((metric) => metric.warnings.length > 0);
  if (warnedMetrics.length) {
    console.warn('\nSIMULATION WARNINGS');
    for (const metric of warnedMetrics) {
      console.warn(
        `  ${metric.patchId === 'current' ? 'Live' : 'Preview'} / ${metric.profession} / ${metric.section} / ${metric.label}`
      );
      for (const warning of metric.warnings) console.warn(`    - ${warning}`);
    }
  }

  const update = await updateManifestBenchmarks(metrics, repoRoot, gameId, {
    preview: activePatchPreview,
    previewMetrics,
    commit: mode === 'commit'
  });
  console.log('\nMANIFEST UPDATES');
  console.log(
    (mode === 'commit' ? 'Saved' : 'Would save') +
      ' preview updates: ' +
      update.previewUpdatedEntries +
      '; preview removals: ' +
      update.previewRemovedEntries +
      '.'
  );
  if (mode === 'commit') {
    console.log(
      `Updated ${update.updatedEntries} DPS/APM/health-band benchmark entries (${update.changedEntries} changed) ` +
        `across ${update.manifestsWritten} manifests.`
    );

    if (update.skippedPresets.length > 0) {
      console.log(`${update.skippedPresets.length} preset(s) without rotations retained their live values:`);

      for (const preset of update.skippedPresets) {
        console.log(`- ${preset.profession} / ${preset.section} / ${preset.label}`);
      }
    }
  } else if (mismatches.length > 0) {
    process.exitCode = 1;
  }
}
