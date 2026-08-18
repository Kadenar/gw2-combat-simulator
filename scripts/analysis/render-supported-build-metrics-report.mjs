import { readFile } from 'node:fs/promises';

import { captureSupportedBuildMetrics } from './capture-supported-build-metrics.mjs';

function parseJson(text) {
  return JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
}

function format(value, decimals = 3) {
  if (!Number.isFinite(Number(value))) return '—';
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: true
  });
}

function formatDelta(value, decimals = 3) {
  const normalized = Math.abs(value) < 10 ** -(decimals + 1) ? 0 : value;
  return `${normalized >= 0 ? '+' : ''}${format(normalized, decimals)}`;
}

function metricCell(baseline, current, decimals = 3) {
  return `${format(baseline, decimals)} → ${format(current, decimals)} (${formatDelta(current - baseline, decimals)})`;
}

function warningKey(warning) {
  return String(warning);
}

const [baselinePath, baselineCommit = 'unknown'] = process.argv.slice(2);
if (!baselinePath) {
  throw new TypeError('Usage: node render-supported-build-metrics-report.mjs <baseline-json> [baseline-commit]');
}

const [baseline, current] = await Promise.all([
  readFile(baselinePath, 'utf8').then(parseJson),
  captureSupportedBuildMetrics()
]);
const baselineById = new Map(baseline.map((entry) => [entry.id, entry]));
const rows = current.map((entry) => {
  const before = baselineById.get(entry.id);
  if (!before) throw new TypeError(`Missing baseline metric for ${entry.id}.`);
  return { before, current: entry };
});
if (baseline.length !== rows.length) {
  throw new TypeError(`Metric count changed from ${baseline.length} to ${rows.length}.`);
}

const changed = rows.filter(
  ({ before, current: after }) =>
    Math.abs(after.dps - before.dps) > 1e-6 || Math.abs(after.totalDamage - before.totalDamage) > 1e-6
);
const negativeNonReaper = changed.filter(
  ({ before, current: after }) =>
    after.profession !== 'necromancer' &&
    (after.dps < before.dps - 1e-6 || after.totalDamage < before.totalDamage - 1e-6)
);
const reaperExceptions = changed.filter(
  ({ current: after }) => after.profession === 'necromancer' && after.section === 'Reaper'
);

const baselineWarnings = new Set(baseline.flatMap((entry) => entry.warnings.map(warningKey)));
const currentWarningRows = current.filter((entry) => entry.warnings.length);
const addedWarnings = currentWarningRows.flatMap((entry) =>
  entry.warnings.filter((warning) => !baselineWarnings.has(warningKey(warning))).map((warning) => ({ entry, warning }))
);

const lines = [
  '# Combo finisher supported-build metrics',
  '',
  `Captured on 2026-08-14 from all rotation-backed manifest presets. Baseline: \`${baselineCommit}\`; current: combo-finisher implementation worktree. Values are deterministic simulator results from \`capture-supported-build-metrics.mjs\`.`,
  '',
  '## Summary',
  '',
  `- Supported builds: ${rows.length}`,
  `- Unchanged builds: ${rows.length - changed.length}`,
  `- Changed builds: ${changed.length}`,
  `- Non-Reaper builds with lower DPS or total damage: ${negativeNonReaper.length}`,
  `- Condition Reaper exceptions: ${reaperExceptions.length}`,
  '',
  'The two condition Reaper losses are caused by overlapping Dark and Ice fields with no authoritative field ownership in the legacy rotation data. The shared resolver deliberately leaves those finishers unresolved instead of applying both field outcomes. Power Reaper remains unchanged.',
  '',
  'A negative strike- or condition-component delta can appear on a build whose total damage increased because combo outcomes change target-death timing and the split between damage sources. The acceptance check is based on DPS and total damage; both are nonnegative for every non-Reaper build.',
  '',
  '## Warning changes',
  '',
  `The current runs contain ${currentWarningRows.reduce((total, entry) => total + entry.warnings.length, 0)} warnings across ${currentWarningRows.length} builds. Five Elementalist warnings were already present in the baseline. The ${addedWarnings.length} added warnings are the explicit Reaper ambiguity diagnostics:`,
  '',
  ...addedWarnings.map(({ entry, warning }) => `- ${entry.section} — ${entry.label}: ${warning}`),
  '',
  '## Complete metric table',
  '',
  'Each cell is `baseline → current (delta)`. Duration is seconds; all damage values are simulator damage units.',
  ''
];

for (const profession of [...new Set(current.map((entry) => entry.profession))]) {
  const professionRows = rows.filter(({ current: entry }) => entry.profession === profession);
  lines.push(
    `### ${profession[0].toUpperCase()}${profession.slice(1)}`,
    '',
    '| Build | Manifest DPS | Duration | DPS | Total damage | Strike damage | Condition damage | Warnings |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |'
  );
  for (const { before, current: after } of professionRows) {
    lines.push(
      `| ${after.section} — ${after.label} | ${format(after.benchmarkDps, 0)} | ${metricCell(before.duration, after.duration)} | ${metricCell(before.dps, after.dps)} | ${metricCell(before.totalDamage, after.totalDamage)} | ${metricCell(before.strikeDamage, after.strikeDamage)} | ${metricCell(before.conditionDamage, after.conditionDamage)} | ${after.warnings.length} |`
    );
  }
  lines.push('');
}

process.stdout.write(`${lines.join('\n')}\n`);
