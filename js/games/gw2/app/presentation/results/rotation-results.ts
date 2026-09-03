import type { ChartOptions, ChartSeries } from '#gw2/app/presentation/results/charts/time-series.js';
import { mountTimeSeriesCharts } from '#gw2/app/presentation/results/charts/time-series.js';
import { mountHitTimeline } from '#ui/results/charts/hit-timeline.js';
import type { RelicComparisonModel } from '#gw2/app/presentation/results/charts/relic-comparison.js';
import {
  bindRelicComparisonChartHover,
  relicComparisonChartSvg
} from '#gw2/app/presentation/results/charts/relic-comparison.js';
import { escapeHtml } from '#gw2/app/presentation/shared/html.js';

// Trusted static disclosure glyph (Lucide trend line).
const DPS_SNAPSHOTS_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="15 7 21 7 21 13"/></svg>`;

const metricDetailsDismissalRoots = new WeakSet<Document>();

export interface ResultRow {
  readonly name: string;
  readonly total?: unknown;
  readonly group?: string;
  readonly [field: string]: unknown;
}

export interface ResultColumn {
  readonly key: string;
  readonly label?: string;
  readonly numeric?: boolean;
  readonly className?: string;
  readonly format?: (value: unknown, row: ResultRow) => unknown;
  // Optional hover tooltip for the cell. Returns plain text (escaped by the
  // renderer); an empty string omits the title attribute.
  readonly title?: (value: unknown, row: ResultRow) => string;
}

export type ResultSortDirection = 'asc' | 'desc' | null;

export interface ResultSortState {
  readonly column: string | null;
  readonly direction: ResultSortDirection;
}

export interface ResultMetric {
  readonly label: string;
  readonly value: unknown;
  readonly className?: string;
  readonly group?: 'player' | 'target';
  readonly details?: readonly ResultMetricDetail[];
}

export interface ResultMetricDetail {
  readonly label: string;
  readonly value: unknown;
}

export interface ResultBreakpoint {
  readonly healthPercent: number;
  readonly dps: number;
  readonly elapsed: number;
  readonly damage?: number;
  readonly environmentDamage?: number;
  readonly targetDamage?: number;
}

export interface ResultCondition {
  readonly name: string;
  readonly damage: number;
  readonly dps: number;
  readonly averageStacks: number;
}

export interface ResultConditionTotal {
  readonly label?: string;
  readonly damage: number;
  readonly dps: number;
}

export interface ResultContribution {
  readonly name: string;
  readonly dpsIncrease: number;
  readonly pctIncrease: number;
  readonly icon?: string;
}

export interface ResultRandomDistribution {
  readonly trials: number;
  readonly mean: number;
  readonly p01: number;
  readonly p10: number;
  readonly p50: number;
  readonly p90: number;
  readonly p99: number;
  readonly explanation?: {
    readonly cohortPercent: number;
    readonly lowDpsMean: number;
    readonly highDpsMean: number;
    readonly drivers: readonly {
      readonly id: string;
      readonly label: string;
      readonly category: string;
      readonly unit: 'count' | 'stacks' | 'value';
      readonly lowAverage: number;
      readonly overallAverage: number;
      readonly highAverage: number;
      readonly delta: number;
      readonly correlation: number;
      readonly estimatedDpsDelta: number;
    }[];
  };
}

export interface ResultRandomDistributionProgress {
  readonly completed?: number;
  readonly total?: number;
  readonly percent?: number;
}

export interface RotationResultsModel {
  readonly metrics?: readonly ResultMetric[];
  readonly summaryPlaceholder?: boolean;
  readonly showSummary?: boolean;
  readonly breakpoints?: readonly ResultBreakpoint[];
  readonly skillRows?: readonly ResultRow[];
  readonly skillColumns?: readonly ResultColumn[];
  readonly conditions?: readonly ResultCondition[];
  readonly conditionTotal?: ResultConditionTotal | null;
  readonly contributions?: readonly ResultContribution[];
  readonly contributionsStale?: boolean;
  readonly contributionsError?: string;
  readonly randomDistribution?: ResultRandomDistribution | null;
  readonly randomDistributionRequested?: boolean;
  readonly randomDistributionStale?: boolean;
  readonly randomDistributionTrials?: number;
  readonly randomDistributionProgress?: ResultRandomDistributionProgress | null;
  readonly randomDistributionError?: string;
  readonly chartSeries?: ChartSeries | null;
  readonly relicComparison?: RelicComparisonModel | null;
  readonly relicComparisonAvailable?: boolean;
  readonly relicComparisonStale?: boolean;
  readonly relicComparisonError?: string;
  readonly relicComparisonOpponent?: string;
  readonly relicComparisonTarget?: string;
  readonly relicComparisonTargets?: readonly string[];
  readonly relicComparisonInitialStacks?: number;
}

export interface RotationResultsOptions {
  readonly resolveSkillIcon?: (row: ResultRow) => string;
  readonly placeholderIcon?: string;
  readonly skillBreakdownClassName?: string;
  readonly chartOptions?: Partial<ChartOptions>;
  readonly sortState?: Partial<ResultSortState>;
  readonly onSortStateChange?: (state: ResultSortState) => unknown;
  readonly onRunRandomDistribution?: () => unknown;
  readonly onRunRelicComparison?: (comparisonRelic: string, initialStacks: number) => unknown;
}

// Default column schema shared by the renderer and profession adapters.
export const SKILL_COLS: readonly ResultColumn[] = [
  { key: 'name', label: 'Skill', numeric: false },
  { key: 'strike', label: 'Strike', numeric: true },
  { key: 'condition', label: 'Condition', numeric: true, className: 'condi' },
  { key: 'total', label: 'Total', numeric: true, className: 'total' },
  { key: 'dps', label: 'DPS', numeric: true, className: 'dps' },
  { key: 'average', label: 'Avg/Cast', numeric: true },
  { key: 'dct', label: 'DCT', numeric: true },
  { key: 'casts', label: 'Casts', numeric: true },
  { key: 'hits', label: 'Hits', numeric: true },
  {
    key: 'critChance',
    label: 'Exp. Crit %',
    numeric: true,
    format: (value) => (value == null ? '—' : `${(Number(value) * 100).toFixed(1)}%`),
    title: (_value, row) => {
      const eligible = Number(row.critEligibleHits || 0);
      if (eligible <= 0) return '';
      const critHits = Number(row.critHits || 0);
      // Deterministic runs yield fractional expected crits; flag those with ~.
      const fractional = Math.abs(critHits - Math.round(critHits)) > 1e-6;
      const critLabel = fractional ? `~${critHits.toFixed(1)}` : String(Math.round(critHits));
      return `${critLabel} of ${eligible} strike hits critical`;
    }
  }
];

export function nextResultSortState(
  currentColumn: string | null,
  currentDirection: ResultSortDirection,
  column: string
): ResultSortState {
  // Repeated clicks cycle descending -> ascending -> default total ordering.
  if (currentColumn !== column) {
    return { column, direction: 'desc' };
  }

  const direction: ResultSortDirection =
    currentDirection === 'desc' ? 'asc' : currentDirection === 'asc' ? null : 'desc';
  return {
    column: direction ? column : null,
    direction
  };
}

export function sortResultRows(
  rows: readonly ResultRow[],
  columns: readonly ResultColumn[],
  column: string | null,
  direction: ResultSortDirection
): ResultRow[] {
  // Never mutate the model supplied by the simulation/result transformer.
  const sorted = [...rows];
  if (!column || !direction) {
    // "Unsorted" means the useful default of highest total damage first.
    return sorted.sort((left, right) => Number(right.total || 0) - Number(left.total || 0));
  }

  const definition = columns.find((candidate) => candidate.key === column);
  if (definition?.numeric) {
    return sorted.sort((left, right) => {
      const leftValue = left[column] ?? -Infinity;
      const rightValue = right[column] ?? -Infinity;
      return direction === 'asc' ? Number(leftValue) - Number(rightValue) : Number(rightValue) - Number(leftValue);
    });
  }

  return sorted.sort((left, right) =>
    direction === 'asc'
      ? String(left[column] ?? '').localeCompare(String(right[column] ?? ''))
      : String(right[column] ?? '').localeCompare(String(left[column] ?? ''))
  );
}

const number = (value: unknown): string => Math.round(Number(value || 0)).toLocaleString();

function signedInteger(value: unknown): string {
  const rounded = Math.round(Number(value || 0));
  const normalized = Object.is(rounded, -0) ? 0 : rounded;
  return `${normalized > 0 ? '+' : ''}${normalized.toLocaleString()}`;
}

function signedFixed(value: unknown, digits = 2): string {
  const numeric = Number(value || 0);
  const threshold = 0.5 / 10 ** digits;
  const normalized = Math.abs(numeric) < threshold ? 0 : numeric;
  return `${normalized > 0 ? '+' : ''}${normalized.toFixed(digits)}`;
}

function randomDriverNumber(value: unknown, unit: 'count' | 'stacks' | 'value'): string {
  const numeric = Number(value || 0);
  if (unit === 'value') return number(numeric);
  return numeric.toLocaleString(undefined, {
    minimumFractionDigits: Math.abs(numeric) < 10 ? 1 : 0,
    maximumFractionDigits: 1
  });
}

function randomDistributionExplanationHtml(distribution: ResultRandomDistribution): string {
  const explanation = distribution.explanation;
  if (!explanation?.drivers?.length) return '';
  const cohort = Math.max(1, Math.round(explanation.cohortPercent || 10));
  const cohortSize = Math.max(1, Math.ceil(Number(distribution.trials || 0) * (cohort / 100)));
  return `<div class="rng-explanation">
    <div class="rng-explanation-heading">
      <strong>What was different in the highest-DPS simulations?</strong>
      <span>${number(cohortSize)} highest vs ${number(cohortSize)} lowest</span>
    </div>
    <p>The ${number(cohortSize)} highest-DPS simulations averaged ${number(explanation.highDpsMean)} DPS. The ${number(cohortSize)} lowest-DPS simulations averaged ${number(explanation.lowDpsMean)} DPS.</p>
    <div class="rng-driver-list">
      ${explanation.drivers
        .map((driver) => {
          const positive = Number(driver.delta) >= 0;
          return `<div class="rng-driver">
          <span class="rng-driver-label">
            <strong>${escapeHtml(driver.label)}</strong>
            <small>Highest-DPS group: ${randomDriverNumber(driver.highAverage, driver.unit)} average per simulation</small>
            <small>Lowest-DPS group: ${randomDriverNumber(driver.lowAverage, driver.unit)} average per simulation</small>
          </span>
          <span class="rng-driver-delta">
            <strong>${positive ? '+' : '&minus;'}${randomDriverNumber(Math.abs(driver.delta), driver.unit)}</strong>
            <small>difference</small>
          </span>
          <span class="rng-driver-impact">
            <strong>&asymp; ${signedInteger(driver.estimatedDpsDelta)} DPS</strong>
            <small>estimated DPS difference</small>
          </span>
        </div>`;
        })
        .join('')}
    </div>
    <p class="rng-explanation-note">These are averages across each group, not counts from one simulation. DPS differences are single-variable trend estimates across all outcomes. Related rows can come from the same proc chain, so do not add them together.</p>
  </div>`;
}

function skillCellHtml(row: ResultRow, column: ResultColumn, options: RotationResultsOptions): string {
  const value = row[column.key];
  if (column.key === 'name') {
    const icon = options.resolveSkillIcon?.(row) || options.placeholderIcon || '';
    return `<span class="res-skill"><img src="${escapeHtml(icon)}" alt="" />${escapeHtml(value)}</span>`;
  }

  const formatted = column.format
    ? column.format(value, row)
    : value == null
      ? '&mdash;'
      : column.numeric
        ? number(value)
        : escapeHtml(value);
  const classAttr = column.className ? ` class="${escapeHtml(column.className)}"` : '';
  const titleText = column.title ? column.title(value, row) : '';
  const titleAttr = titleText ? ` title="${escapeHtml(titleText)}"` : '';
  // Custom formatters return display text, not trusted HTML.
  return `<span${classAttr}${titleAttr}>${column.format ? escapeHtml(formatted) : formatted}</span>`;
}

function skillRowHtml(row: ResultRow, columns: readonly ResultColumn[], options: RotationResultsOptions): string {
  const skillKey = typeof row.key === 'string' ? row.key : '';
  const keyAttr = skillKey ? ` data-skill-key="${escapeHtml(skillKey)}" role="button" tabindex="0"` : '';
  const selectable = skillKey ? ' res-row-selectable' : '';
  return `<div class="res-row${selectable}"${keyAttr}>${columns
    .map((column) => skillCellHtml(row, column, options))
    .join('')}</div>`;
}

function skillRowsHtml(
  rows: readonly ResultRow[],
  columns: readonly ResultColumn[],
  options: RotationResultsOptions
): string {
  const hasGroups = rows.some((row) => typeof row.group === 'string' && row.group.trim());
  if (!hasGroups) {
    return rows.map((row) => skillRowHtml(row, columns, options)).join('');
  }

  const grouped = new Map<string, ResultRow[]>();
  for (const row of rows) {
    const group = typeof row.group === 'string' && row.group.trim() ? row.group.trim() : 'Other';
    const groupRows = grouped.get(group) || [];
    groupRows.push(row);
    grouped.set(group, groupRows);
  }

  const preferredOrder = new Map([
    ['Player', 0],
    ['Entities', 1],
    ['Environment', 2],
    ['Other', 3]
  ]);
  const groupNames = [...grouped.keys()].sort(
    (left, right) => (preferredOrder.get(left) ?? 3) - (preferredOrder.get(right) ?? 3)
  );
  const summaryColumns = new Set(['strike', 'condition', 'total', 'dps']);
  return groupNames
    .map((group) => {
      const groupRows = grouped.get(group) || [];
      return `<div class="res-skill-group-heading" data-skill-group="${escapeHtml(group)}">
      ${columns
        .map((column) => {
          if (column.key === 'name') {
            return `<span class="res-skill-group-name">${escapeHtml(group)}</span>`;
          }

          if (!summaryColumns.has(column.key)) {
            return '<span aria-hidden="true"></span>';
          }

          const total = groupRows.reduce((sum, row) => sum + Number(row[column.key] || 0), 0);
          const label = column.label || column.key;
          const classAttr = column.className ? ` ${escapeHtml(column.className)}` : '';
          return `<span class="res-skill-group-total${classAttr}" aria-label="${escapeHtml(`${group} ${label}: ${number(total)}`)}">${number(total)}</span>`;
        })
        .join('')}
    </div>${groupRows.map((row) => skillRowHtml(row, columns, options)).join('')}`;
    })
    .join('');
}

function skillHeaderHtml(columns: readonly ResultColumn[], sortState: ResultSortState): string {
  return columns
    .map((column) => {
      const indicator = sortState.column === column.key ? (sortState.direction === 'asc' ? ' ▲' : ' ▼') : '';
      return `<span data-sort-col="${escapeHtml(column.key)}">${escapeHtml(column.label || column.key)}${indicator}</span>`;
    })
    .join('');
}

/** Renders an accessible native disclosure beside a metric label when contributor details are available. */
function resultMetricDetailsHtml(metric: ResultMetric): string {
  const details = metric.details || [];
  if (!details.length) return '';
  const title = `${metric.label} breakdown`;
  return `<details class="res-metric-info">
    <summary aria-label="${escapeHtml(`Show ${title}`)}" title="${escapeHtml(`Show ${title}`)}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><line x1="12" x2="12" y1="11" y2="17"/><line x1="12" x2="12.01" y1="7" y2="7"/></svg>
    </summary>
    <div class="res-metric-info-panel">
      <strong>${escapeHtml(title)}</strong>
      <dl>
        ${details
          .map(
            (detail) => `<div>
          <dt>${escapeHtml(detail.label)}</dt>
          <dd>${escapeHtml(detail.value)}</dd>
        </div>`
          )
          .join('')}
      </dl>
    </div>
  </details>`;
}

/** Anchors target-health DPS snapshots to the DPS metric so they do not consume a separate result row. */
function resultDpsSnapshotsHtml(metric: ResultMetric, breakpoints: readonly ResultBreakpoint[]): string {
  return `<div class="res-label-row">
    <details class="res-dps-snapshots">
      <summary aria-label="Show DPS snapshots" title="Show DPS snapshots">
        <span class="res-label">${escapeHtml(metric.label)}</span>
        <svg class="res-dps-snapshots-info" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><line x1="12" x2="12" y1="11" y2="17"/><line x1="12" x2="12.01" y1="7" y2="7"/></svg>
        <span class="res-dps-snapshots-chevron" aria-hidden="true"></span>
      </summary>
      <div class="res-dps-snapshots-panel">
        <div class="res-dps-snapshots-heading">${DPS_SNAPSHOTS_ICON}<strong>DPS snapshots</strong></div>
        <div class="res-dps-snapshots-list">
          ${breakpoints
            .map(
              (breakpoint) => `<div class="res-dps-snapshot">
            <span class="res-dps-snapshot-health"><b>${number(breakpoint.healthPercent)}%</b> target health</span>
            <strong>${number(breakpoint.dps)} <small>DPS</small></strong>
            <span class="res-dps-snapshot-time">at ${Number(breakpoint.elapsed || 0).toFixed(2)}s</span>
          </div>`
            )
            .join('')}
        </div>
      </div>
    </details>
    ${resultMetricDetailsHtml(metric)}
  </div>`;
}

/** Closes open metric disclosures unless the click occurred inside that same disclosure. */
export function dismissResultMetricDetails(root: ParentNode, target: EventTarget | null): void {
  for (const details of root.querySelectorAll<HTMLDetailsElement>('.res-metric-info[open], .res-dps-snapshots[open]')) {
    if (target && details.contains(target as Node)) continue;
    details.open = false;
  }
}

/** Uses pointerdown before the native details click toggle so the opening interaction cannot dismiss itself. */
function bindResultMetricDetailsDismissal(container: HTMLElement): void {
  const root = container.ownerDocument;
  if (!root || metricDetailsDismissalRoots.has(root)) return;
  metricDetailsDismissalRoots.add(root);
  root.addEventListener('pointerdown', (event) => dismissResultMetricDetails(root, event.target));
}

export function mountRotationResults(
  container: HTMLElement | null | undefined,
  model: RotationResultsModel = {},
  options: RotationResultsOptions = {}
): {
  readonly getSortState: () => ResultSortState;
  readonly renderSortedRows: () => void;
} | null {
  if (!container) return null;
  bindResultMetricDetailsDismissal(container);
  const metrics = model.metrics || [];
  const summaryPlaceholder = model.summaryPlaceholder === true;
  const showSummary = model.showSummary !== false;
  const breakpoints = model.breakpoints || [];
  const skillRows = model.skillRows || [];
  const skillColumns = model.skillColumns || [];
  const conditions = model.conditions || [];
  // Keep damage-dealing conditions prominent while retaining utility-condition stack visibility.
  const conditionGroups = [
    { label: 'Damaging Conditions', conditions: conditions.filter((condition) => condition.damage > 0) },
    { label: 'Other Conditions', conditions: conditions.filter((condition) => condition.damage <= 0) }
  ].filter((group) => group.conditions.length);
  // Contributions compare reruns with one modifier disabled; the UI warns that invalid rotations skew results.
  const contributions = model.contributions || [];
  const contributionsStale = model.contributionsStale === true;
  const contributionsError = String(model.contributionsError || '');
  const randomDistribution = model.randomDistribution || null;
  const randomDistributionRequested = model.randomDistributionRequested === true;
  const randomDistributionStale = model.randomDistributionStale === true;
  const randomDistributionTrials = Number(randomDistribution?.trials || model.randomDistributionTrials || 0);
  const randomDistributionProgress = model.randomDistributionProgress || {};
  const randomDistributionCompleted = Math.max(
    0,
    Math.min(randomDistributionTrials, Number(randomDistributionProgress.completed || 0))
  );
  const randomDistributionPercent = Math.max(
    0,
    Math.min(
      100,
      Number(
        randomDistributionProgress.percent ??
          (randomDistributionTrials > 0 ? (randomDistributionCompleted / randomDistributionTrials) * 100 : 0)
      )
    )
  );
  const randomDistributionError = String(model.randomDistributionError || '');
  const randomDistributionAction = !randomDistributionStale
    ? `<button type="button" class="rng-run-button" data-role="rng-run">
          ${randomDistributionError ? 'Retry' : randomDistribution ? 'Recalculate' : 'Calculate range'}
        </button>`
    : '';
  const chartSeries = model.chartSeries || null;
  const relicComparison = model.relicComparison || null;
  const relicComparisonAvailable = model.relicComparisonAvailable === true;
  const relicComparisonStale = model.relicComparisonStale === true;
  const relicComparisonError = String(model.relicComparisonError || '');
  const relicComparisonOpponent = String(model.relicComparisonOpponent || '');
  const relicComparisonTargets = model.relicComparisonTargets || [];
  const requestedRelicComparisonTarget = String(model.relicComparisonTarget || '');
  const relicComparisonTarget = relicComparisonTargets.includes(requestedRelicComparisonTarget)
    ? requestedRelicComparisonTarget
    : String(relicComparisonTargets[0] || '');
  const relicComparisonInitialStacks = Math.min(
    10,
    Math.max(0, Math.trunc(Number(model.relicComparisonInitialStacks) || 0))
  );
  const relicComparisonAction = `<label class="relic-cmp-control">
          Compare with
          <select data-role="relic-comparison-target" aria-label="Comparison relic">
            ${relicComparisonTargets
              .map(
                (name) =>
                  `<option value="${escapeHtml(name)}"${name === relicComparisonTarget ? ' selected' : ''}>Relic of ${escapeHtml(name)}</option>`
              )
              .join('')}
          </select>
        </label>
        <label class="relic-cmp-control" data-role="relic-comparison-stacks-control"${relicComparisonTarget === 'Thorns' ? '' : ' hidden'}>
          Starting stacks
          <input type="number" min="0" max="10" step="1" value="${relicComparisonInitialStacks}" data-role="relic-comparison-stacks" aria-label="Starting Thorns stacks" />
        </label>
        <button type="button" class="relic-cmp-run-button" data-role="relic-comparison-run"${relicComparisonStale ? ' disabled' : ''}>
          ${relicComparisonStale ? 'Running…' : relicComparisonError ? 'Retry' : relicComparison ? 'Run again' : 'Run comparison'}
        </button>`;
  let sortState: ResultSortState = {
    column: options.sortState?.column || null,
    direction: options.sortState?.direction || null
  };
  const breakdownClassName = options.skillBreakdownClassName || 'skill-breakdown';
  const initialSkillRows = sortResultRows(skillRows, skillColumns, sortState.column, sortState.direction);

  // Replacing the subtree gives every mount a clean DOM/event-handler slate.
  // Damage and conditions share one card so the analysis reads as one ordered breakdown.
  container.innerHTML = `${
    showSummary
      ? `<div class="res-summary${summaryPlaceholder ? ' res-summary-placeholder' : ''}"${
          summaryPlaceholder ? ' aria-label="Rotation metrics unavailable until skills are added"' : ''
        }>
    ${metrics
      .map((metric, index) => {
        // The first target-owned metric creates a right-anchored group distinct from player attribution.
        const startsTargetGroup = metric.group === 'target' && metrics[index - 1]?.group !== 'target';
        return `<div class="res-stat${metric.group === 'target' ? ' res-stat-target' : ''}${startsTargetGroup ? ' res-stat-target-start' : ''}">
      ${breakpoints.length && metric.className === 'dps' ? resultDpsSnapshotsHtml(metric, breakpoints) : `<div class="res-label-row"><span class="res-label">${escapeHtml(metric.label)}</span>${resultMetricDetailsHtml(metric)}</div>`}
      <span class="res-val${metric.className ? ` ${escapeHtml(metric.className)}` : ''}">${escapeHtml(metric.value)}</span>
    </div>`;
      })
      .join('')}
  </div>`
      : ''
  }
  ${
    randomDistributionRequested
      ? `<section class="rng-distribution">
    <div class="rng-distribution-heading">
      <div>
        <h4>Randomized DPS range</h4>
        <p>See how weapon strength and supported random procs affect expected DPS.</p>
      </div>
      <div class="rng-distribution-heading-actions">
        ${randomDistributionTrials ? `<span>${number(randomDistributionTrials)} simulations</span>` : ''}
        ${randomDistributionAction}
      </div>
    </div>
    ${
      randomDistributionStale
        ? `<div class="rng-distribution-progress"
          data-role="rng-progress"
          role="progressbar"
          aria-label="Calculating randomized DPS range"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow="${Math.round(randomDistributionPercent)}">
          <div class="rng-distribution-progress-track">
            <span data-role="rng-progress-bar" style="width: ${randomDistributionPercent}%"></span>
          </div>
          <span data-role="rng-progress-label">${number(
            randomDistributionCompleted
          )} / ${number(randomDistributionTrials)} simulations (${Math.round(randomDistributionPercent)}%)</span>
        </div>`
        : randomDistributionError
          ? `<div class="rng-distribution-status rng-distribution-error">${escapeHtml(randomDistributionError)}</div>`
          : randomDistribution
            ? `<div class="rng-distribution-grid">
            <div class="rng-distribution-stat">
              <span>Expected</span>
              <strong>${number(randomDistribution.mean)}</strong>
              <small>Mean DPS</small>
            </div>
            <div class="rng-distribution-stat">
              <span>Typical</span>
              <strong>${number(randomDistribution.p50)}</strong>
              <small>P50 DPS</small>
            </div>
            <div class="rng-distribution-stat rng-distribution-range">
              <span>Likely range</span>
              <strong>${number(randomDistribution.p10)}&ndash;${number(randomDistribution.p90)}</strong>
              <small>P10&ndash;P90 DPS</small>
            </div>
            <div class="rng-distribution-stat rng-unlucky">
              <span>Rare low outcome</span>
              <strong>${number(randomDistribution.p01)}</strong>
              <small>About 1 in 100 runs are lower</small>
            </div>
            <div class="rng-distribution-stat rng-lucky">
              <span>Rare high outcome</span>
              <strong>${number(randomDistribution.p99)}</strong>
              <small>About 1 in 100 runs are higher</small>
            </div>
          </div>
          ${randomDistributionExplanationHtml(randomDistribution)}`
            : ''
    }
  </section>`
      : ''
  }
  ${
    skillColumns.length || conditions.length
      ? `<section class="res-breakdown-section">
    <div class="res-breakdown">
      ${
        skillColumns.length
          ? `<div class="res-breakdown-part res-damage-breakdown">
      <div class="res-section-title">Damage Breakdown</div>
      <div class="${escapeHtml(breakdownClassName)}" data-role="skill-breakdown">
        <div class="res-hdr res-hdr-sortable" data-role="skill-header">
          ${skillHeaderHtml(skillColumns, sortState)}
        </div>
        <div class="res-skill-rows" data-role="skill-rows">${skillRowsHtml(initialSkillRows, skillColumns, options)}</div>
      </div>
    </div>`
          : ''
      }
      ${
        conditions.length
          ? `<div class="res-breakdown-part res-condition-breakdown">
      <div class="res-section-title">Conditions</div>
      <div class="cond-breakdown">
        ${conditionGroups
          .map(
            (group) => `<div class="res-condition-group">
          <div class="res-condition-group-title">${group.label}</div>
          <div class="res-hdr cond-hdr">
            <span>Condition</span><span>Damage</span><span>DPS</span><span>Avg Stacks</span>
          </div>
          ${group.conditions
            .map(
              (condition) => `<div class="res-row">
          <span class="res-skill condi">${escapeHtml(condition.name)}</span>
          <span class="condi">${number(condition.damage)}</span>
          <span class="dps">${number(condition.dps)}</span>
          <span>${Number(condition.averageStacks || 0).toFixed(2)}</span>
        </div>`
            )
            .join('')}
        </div>`
          )
          .join('')}
        ${
          model.conditionTotal
            ? `<div class="res-row res-total">
          <span class="res-skill"><b>${escapeHtml(model.conditionTotal.label || 'Total Conditions')}</b></span>
          <span class="condi"><b>${number(model.conditionTotal.damage)}</b></span>
          <span class="dps"><b>${number(model.conditionTotal.dps)}</b></span>
          <span></span>
        </div>`
            : ''
        }
      </div>
    </div>`
          : ''
      }
    </div>
  </section>`
      : ''
  }
  ${chartSeries ? '<div data-role="result-charts"></div>' : ''}
  ${
    relicComparisonAvailable
      ? `<section class="relic-cmp">
    <div class="relic-cmp-heading">
      <div>
        <h4>Relic break-even comparison</h4>
        <p>Choose a relic to compare against ${escapeHtml(relicComparisonOpponent ? `Relic of ${relicComparisonOpponent}` : 'your equipped relic')} across fight durations.</p>
      </div>
    </div>
    <div class="relic-cmp-manual">${relicComparisonAction}</div>
    ${
      relicComparisonStale
        ? `<div class="relic-cmp-skeleton" role="status">Running comparison simulation…</div>`
        : relicComparisonError
          ? `<div class="relic-cmp-status relic-cmp-error">${escapeHtml(relicComparisonError)}</div>`
          : relicComparison
            ? relicComparisonChartSvg(relicComparison, {
                opponentLabel: relicComparisonOpponent ? `Relic of ${relicComparisonOpponent}` : undefined
              })
            : ''
    }
  </section>`
      : ''
  }
  ${
    contributions.length || contributionsStale || contributionsError
      ? `<div class="res-contributions">
    <h4>
      <span>Modifier Contributions</span>
      ${contributionsStale ? '<span class="contrib-status">Recalculating</span>' : ''}
    </h4>
    <p class="contrib-disclaimer">Values are estimated by disabling each modifier and rerunning the simulation. They may be misleading if doing so breaks the rotation.</p>
    ${
      contributions.length
        ? `<div class="contrib-table">
      <div class="contrib-hdr">
        <span>Modifier</span><span>DPS Increase</span><span>% Increase</span>
      </div>
      ${contributions
        .map((contribution) => {
          return `<div class="contrib-row">
          <span class="contrib-name">${
            contribution.icon ? `<img src="${escapeHtml(contribution.icon)}" alt="" />` : ''
          }${escapeHtml(contribution.name)}</span>
          <span class="contrib-val">${signedInteger(contribution.dpsIncrease)}</span>
          <span class="contrib-pct">${signedFixed(contribution.pctIncrease)}%</span>
        </div>`;
        })
        .join('')}
    </div>`
        : contributionsError
          ? `<div class="contrib-pending contrib-error">${escapeHtml(contributionsError)}</div>`
          : '<div class="contrib-pending">Calculating modifier contributions…</div>'
    }
  </div>`
      : ''
  }`;

  const renderSortedRows = (): void => {
    const sorted = sortResultRows(skillRows, skillColumns, sortState.column, sortState.direction);
    const rowsElement = container.querySelector<HTMLElement>('[data-role="skill-rows"]');
    if (rowsElement) {
      rowsElement.innerHTML = skillRowsHtml(sorted, skillColumns, options);
      // Re-rendering discards row handlers; rebind selection and reapply it.
      bindSkillSelection();
    }

    const header = container.querySelector<HTMLElement>('[data-role="skill-header"]');
    if (header) {
      header.innerHTML = skillHeaderHtml(skillColumns, sortState);
      // Replacing header markup discards its handlers, so bind the new cells.
      bindSort();
    }
  };

  const bindSort = (): void => {
    const header = container.querySelector<HTMLElement>('[data-role="skill-header"]');
    for (const cell of header?.querySelectorAll<HTMLElement>('[data-sort-col]') || []) {
      cell.onclick = () => {
        sortState = nextResultSortState(sortState.column, sortState.direction, cell.dataset.sortCol || '');
        options.onSortStateChange?.({ ...sortState });
        renderSortedRows();
      };
    }
  };

  let selectedSkillKey: string | null = null;
  let chartHandle: {
    readonly setSelectedSkill: (key: string | null) => void;
  } | null = null;
  const applySkillRowSelection = (): void => {
    for (const rowElement of container.querySelectorAll<HTMLElement>('[data-role="skill-rows"] .res-row-selectable')) {
      const active = rowElement.dataset.skillKey === selectedSkillKey;
      rowElement.classList.toggle('res-row-selected', active);
      rowElement.setAttribute('aria-pressed', String(active));
    }
  };

  // Inline "Damage Events" timeline inserted beneath the selected row, showing
  // one marker per hit. Removed and re-inserted so it survives row re-sorts.
  const renderSkillTimeline = (): void => {
    const rowsRoot = container.querySelector<HTMLElement>('[data-role="skill-rows"]');
    if (!rowsRoot) return;
    rowsRoot.querySelector('[data-role="skill-timeline"]')?.remove();
    if (!selectedSkillKey || !chartSeries) return;
    const hits = chartSeries.skillDamage?.[selectedSkillKey];
    if (!hits || !hits.length) return;
    let target: HTMLElement | null = null;
    for (const rowElement of rowsRoot.querySelectorAll<HTMLElement>('.res-row-selectable')) {
      if (rowElement.dataset.skillKey === selectedSkillKey) {
        target = rowElement;
        break;
      }
    }

    const doc = container.ownerDocument;
    if (!target || !doc || typeof target.after !== 'function') return;
    const timeline = doc.createElement('div');
    timeline.className = 'res-skill-timeline';
    timeline.setAttribute('data-role', 'skill-timeline');
    target.after(timeline);
    mountHitTimeline(timeline, hits, {
      durationMs: chartSeries.durationMs,
      color: options.chartOptions?.skillDamageColor,
      label: 'Damage Events'
    });
  };

  const selectSkill = (key: string | null): void => {
    // Clicking the active row again clears the selection.
    selectedSkillKey = key && key === selectedSkillKey ? null : key;
    applySkillRowSelection();
    chartHandle?.setSelectedSkill(selectedSkillKey);
    renderSkillTimeline();
  };

  const bindSkillSelection = (): void => {
    for (const rowElement of container.querySelectorAll<HTMLElement>('[data-role="skill-rows"] .res-row-selectable')) {
      rowElement.onclick = () => selectSkill(rowElement.dataset.skillKey || null);
      rowElement.onkeydown = (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectSkill(rowElement.dataset.skillKey || null);
        }
      };
    }

    applySkillRowSelection();
    renderSkillTimeline();
  };

  bindSort();
  const chartContainer = container.querySelector<HTMLElement>('[data-role="result-charts"]');
  if (chartContainer && chartSeries) {
    // Charts mount only when the transformed model supplies sampled series.
    chartHandle =
      mountTimeSeriesCharts(chartContainer, chartSeries, {
        ...(options.chartOptions || {}),
        healthBreakpoints: breakpoints
      }) || null;
  }

  // The comparison SVG uses the same hover-value interaction as the time-series charts.
  if (relicComparison) bindRelicComparisonChartHover(container, relicComparison);

  bindSkillSelection();
  const runRandomDistribution = container.querySelector<HTMLElement>('[data-role="rng-run"]');
  if (runRandomDistribution && typeof options.onRunRandomDistribution === 'function') {
    runRandomDistribution.onclick = () => {
      options.onRunRandomDistribution?.();
    };
  }

  const runRelicComparison = container.querySelector<HTMLElement>('[data-role="relic-comparison-run"]');
  const relicComparisonTargetInput = container.querySelector<HTMLSelectElement>(
    '[data-role="relic-comparison-target"]'
  );
  const relicComparisonStacksControl = container.querySelector<HTMLElement>(
    '[data-role="relic-comparison-stacks-control"]'
  );

  if (relicComparisonTargetInput && relicComparisonStacksControl) {
    // Thorns alone needs opening stack configuration; other relics keep the control out of the way.
    relicComparisonTargetInput.onchange = () => {
      relicComparisonStacksControl.hidden = relicComparisonTargetInput.value !== 'Thorns';
    };
  }

  if (runRelicComparison && typeof options.onRunRelicComparison === 'function') {
    runRelicComparison.onclick = () => {
      const initialStacks = container.querySelector<HTMLInputElement>('[data-role="relic-comparison-stacks"]');
      options.onRunRelicComparison?.(
        relicComparisonTargetInput?.value || relicComparisonTarget,
        Number(initialStacks?.value || 0)
      );
    };
  }

  return { getSortState: () => ({ ...sortState }), renderSortedRows };
}
