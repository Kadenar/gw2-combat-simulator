import type { ChartSeries } from '#gw2/app/results/charts/time-series-model.js';
import { mountTimeSeriesCharts, type ChartOptions } from '#gw2/app/results/charts/time-series-view.js';
import { mountHitTimeline } from '#ui/results/charts/hit-timeline-view.js';
import { bindDialog, showDialog } from '#app/page/dialog.js';
import { escapeHtml } from '#ui/shared/html.js';
import type { Gw2ProcStep } from '#gw2/platform/resolver/types.js';
import type { SkillBreakdownRow } from '#gw2/app/results/skill-breakdown.js';
import { boundedNumber } from '#kernel/core/numeric.js';
import { MODIFIER_EFFECT_ICONS } from '#gw2/app/shared/icons.js';

// Trusted static disclosure glyph (Lucide trend line).
const DPS_SNAPSHOTS_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="15 7 21 7 21 13"/></svg>`;

// Runtime condition names differ from the build-control labels used by the shared artwork catalog.
const CONDITION_ICON_LABELS: Readonly<Record<string, string>> = {
  Blinded: 'Blindness',
  Crippled: 'Cripple',
  Immobilized: 'Immobilize'
};

const metricDetailsDismissalRoots = new WeakSet<Document>();

export interface ResultRow {
  readonly name: string;
  readonly total?: unknown;
  readonly group?: string;
  readonly procDamage?: SkillBreakdownRow['procDamage'];
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
  readonly title?: string;
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
  /** Recorded activations with timestamps relative to the same DPS window as the charts. */
  readonly procSteps?: readonly Pick<Gw2ProcStep, 'start' | 'skill' | 'sourceSkill'>[];
}

export interface RotationResultsOptions {
  readonly resolveSkillIcon?: (row: ResultRow) => string;
  readonly placeholderIcon?: string;
  readonly skillBreakdownClassName?: string;
  readonly chartOptions?: Partial<ChartOptions>;
  readonly sortState?: Partial<ResultSortState>;
  readonly onSortStateChange?: (state: ResultSortState) => unknown;
  readonly onRunRandomDistribution?: () => unknown;
}

// Default column schema shared by the renderer and profession adapters.
export const SKILL_COLS: readonly ResultColumn[] = [
  { key: 'name', label: 'Skill', numeric: false },
  { key: 'strike', label: 'Strike', numeric: true },
  { key: 'condition', label: 'Condition', numeric: true, className: 'condi' },
  { key: 'total', label: 'Total', numeric: true, className: 'total' },
  { key: 'damagePercent', label: '% Damage', numeric: true, format: (value) => `${Number(value).toFixed(2)}%` },
  { key: 'dps', label: 'DPS', numeric: true, className: 'dps' },
  { key: 'average', label: 'Avg/Cast', numeric: true },
  { key: 'dct', label: 'DCT', numeric: true },
  { key: 'casts', label: 'Casts', numeric: true },
  {
    key: 'hits',
    label: 'Hits',
    numeric: true,
    title: (_value, row) =>
      Number(row.procCount) > 0 && !Number(row.strike)
        ? 'Proc activations, excluding condition ticks and stack counts.'
        : 'Strike hits.'
  },
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

/** Plots the existing percentiles on one DPS scale, with separate label lanes when values cluster. */
function randomDistributionRangeHtml(distribution: ResultRandomDistribution): string {
  const markers = [
    { label: '1st pct', value: distribution.p01, className: 'rng-tail' },
    { label: 'P10', value: distribution.p10, className: 'rng-likely' },
    { label: 'Median', value: distribution.p50, className: 'rng-median' },
    { label: 'Expected', value: distribution.mean, className: 'rng-expected' },
    { label: 'P90', value: distribution.p90, className: 'rng-likely' },
    { label: '99th pct', value: distribution.p99, className: 'rng-tail' }
  ];
  const minimum = Math.min(...markers.map((marker) => marker.value));
  const maximum = Math.max(...markers.map((marker) => marker.value));
  const padding = Math.max((maximum - minimum) * 0.08, 1);
  const start = Math.max(0, minimum - padding);
  const end = maximum + padding;
  const position = (value: number): number => 55 + ((value - start) / (end - start)) * 890;
  const lanes: number[] = [];
  const plotted = [...markers]
    .sort((left, right) => left.value - right.value)
    .map((marker) => {
      const x = position(marker.value);
      let lane = lanes.findIndex((previous) => x - previous >= 100);
      if (lane < 0) lane = lanes.length;
      lanes[lane] = x;
      return { ...marker, x, lane };
    });
  const axisY = 30 + lanes.length * 38;
  const halfRange = (distribution.p90 - distribution.p10) / 2;
  const percent = distribution.mean > 0 ? (halfRange / distribution.mean) * 100 : 0;
  return `<div class="rng-range-panel">
    <details class="rng-raw-data">
      <summary>View as table</summary>
      <div class="rng-table-scroll" tabindex="0" role="region" aria-label="DPS percentile data">
        <table class="rng-data-table"><caption>Randomized DPS summary</caption>
          <thead><tr><th scope="col">Statistic</th><th scope="col">DPS</th></tr></thead>
          <tbody>${markers.map((marker) => `<tr><th scope="row">${marker.label}</th><td>${number(marker.value)}</td></tr>`).join('')}</tbody>
        </table>
      </div>
    </details>
    <div class="rng-chart-scroll" tabindex="0" role="region" aria-label="Randomized DPS range chart">
      <svg class="rng-range-chart" viewBox="0 0 1000 ${axisY + 40}" role="img" aria-label="Expected DPS ${number(distribution.mean)}; median ${number(distribution.p50)}; P10 to P90 ${number(distribution.p10)} to ${number(distribution.p90)}; 1st percentile ${number(distribution.p01)}; 99th percentile ${number(distribution.p99)}">
        <line class="rng-axis" x1="25" x2="975" y1="${axisY}" y2="${axisY}" />
        <line class="rng-range-glow" x1="${position(distribution.p10)}" x2="${position(distribution.p90)}" y1="${axisY}" y2="${axisY}" />
        <line class="rng-range-line" x1="${position(distribution.p10)}" x2="${position(distribution.p90)}" y1="${axisY}" y2="${axisY}" />
        ${Array.from({ length: 5 }, (_, index) => {
          const value = start + ((end - start) * index) / 4;
          const x = position(value);
          return `<line class="rng-axis" x1="${x}" x2="${x}" y1="${axisY}" y2="${axisY + 7}" /><text class="rng-axis-label" x="${x}" y="${axisY + 24}">${number(value)}</text>`;
        }).join('')}
        ${plotted
          .map((marker) => {
            const y = axisY - 28 - marker.lane * 38;
            return `<g class="${marker.className}">
            <line class="rng-marker-stem" x1="${marker.x}" x2="${marker.x}" y1="${axisY - 13}" y2="${axisY}" />
            <text class="rng-marker-label" x="${marker.x}" y="${y}">${marker.label}</text>
            <text class="rng-marker-value" x="${marker.x}" y="${y + 16}">${number(marker.value)}</text>
            <circle cx="${marker.x}" cy="${axisY}" r="${marker.className === 'rng-expected' ? 4 : 3}" />
          </g>`;
          })
          .join('')}
      </svg>
    </div>
    <div class="rng-range-summary">
      <span>Likely range: <strong>${number(distribution.p10)}&ndash;${number(distribution.p90)}</strong></span>
      <span title="Half the P10–P90 interval, not standard deviation">Typical spread: <b>&plusmn;${number(halfRange)} DPS (&plusmn;${percent.toFixed(1)}%)</b></span>
    </div>
  </div>`;
}

/** Compares the outcome cohorts using relative impact bars without implying additive attribution. */
function randomDistributionExplanationHtml(distribution: ResultRandomDistribution): string {
  const explanation = distribution.explanation;
  if (!explanation?.drivers?.length) return '';
  const cohort = Math.max(1, Math.round(explanation.cohortPercent || 10));
  const cohortSize = Math.max(1, Math.ceil(Number(distribution.trials || 0) * (cohort / 100)));
  const maxImpact = Math.max(1, ...explanation.drivers.map((driver) => Math.abs(driver.estimatedDpsDelta)));
  return `<div class="rng-explanation">
    <div class="rng-explanation-heading">
      <h4>What drove the difference?</h4>
      <span>Top ${number(cohortSize)} vs bottom ${number(cohortSize)} simulations</span>
    </div>
    <p>The ${number(cohortSize)} highest-DPS simulations averaged ${number(explanation.highDpsMean)} DPS. The ${number(cohortSize)} lowest-DPS simulations averaged ${number(explanation.lowDpsMean)} DPS.</p>
    <div class="rng-table-scroll" tabindex="0" role="region" aria-label="Factors driving DPS differences">
      <table class="rng-driver-table">
        <thead><tr><th scope="col">Factor</th><th scope="col">Low DPS</th><th scope="col">High DPS</th><th scope="col">&Delta;</th><th scope="col">Est. DPS impact</th></tr></thead>
        <tbody>
      ${explanation.drivers
        .map((driver) => {
          const positive = Number(driver.delta) >= 0;
          return `<tr>
          <th scope="row">${escapeHtml(driver.label)}</th>
          <td>${randomDriverNumber(driver.lowAverage, driver.unit)}</td>
          <td>${randomDriverNumber(driver.highAverage, driver.unit)}</td>
          <td class="${positive ? 'rng-positive' : 'rng-negative'}">${positive ? '+' : '&minus;'}${randomDriverNumber(Math.abs(driver.delta), driver.unit)}</td>
          <td><div class="rng-driver-impact ${driver.estimatedDpsDelta >= 0 ? 'rng-positive' : 'rng-negative'}">
            <span class="rng-impact-track" aria-hidden="true"><span style="width: ${(Math.abs(driver.estimatedDpsDelta) / maxImpact) * 100}%"></span></span>
            <strong>&asymp; ${signedInteger(driver.estimatedDpsDelta)} DPS</strong>
          </div></td>
        </tr>`;
        })
        .join('')}
        </tbody>
      </table>
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
  const summaryColumns = new Set(['strike', 'condition', 'total', 'damagePercent', 'dps']);
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
          const formatted = column.format ? String(column.format(total, { name: group })) : number(total);
          const label = column.label || column.key;
          const classAttr = column.className ? ` ${escapeHtml(column.className)}` : '';
          return `<span class="res-skill-group-total${classAttr}" aria-label="${escapeHtml(`${group} ${label}: ${formatted}`)}">${escapeHtml(formatted)}</span>`;
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

/** Closes open result disclosures unless the click occurred inside that same disclosure. */
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

/** Renders modifier status independently so worker completion preserves chart and table interactions. */
export function modifierContributionsHtml(model: RotationResultsModel): string {
  const contributions = model.contributions || [];
  const contributionsStale = model.contributionsStale === true;
  const contributionsError = String(model.contributionsError || '');
  return `${
    contributions.length || contributionsStale || contributionsError
      ? `<div class="res-contributions">
    <h4>
      <span>Modifier Contributions</span>
    </h4>
    <p class="contrib-disclaimer">Values are estimated by disabling each modifier and rerunning the simulation. They may be misleading if doing so breaks the rotation.</p>
    ${
      contributionsStale
        ? '<div class="contrib-pending" role="status">Calculating modifier contributions&hellip;</div>'
        : contributions.length
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
  // Conditions already belong to skill totals; use one denominator across all damage sources without double counting.
  const totalDamage = (model.skillRows || []).reduce((sum, row) => sum + Number(row.total || 0), 0);
  const damagePercent = (damage: number): number => (totalDamage > 0 ? (damage / totalDamage) * 100 : 0);
  const skillRows: ResultRow[] = (model.skillRows || []).map((row) => ({
    ...row,
    damagePercent: damagePercent(Number(row.total || 0))
  }));
  const skillColumns = model.skillColumns || [];
  const conditions = model.conditions || [];
  // Keep damage-dealing conditions prominent while retaining utility-condition stack visibility.
  const conditionGroups = [
    {
      label: 'Damaging Conditions',
      damaging: true,
      conditions: conditions.filter((condition) => condition.damage > 0)
    },
    { label: 'Other Conditions', damaging: false, conditions: conditions.filter((condition) => condition.damage <= 0) }
  ].filter((group) => group.conditions.length);
  const randomDistribution = model.randomDistribution || null;
  const randomDistributionRequested = model.randomDistributionRequested === true;
  const randomDistributionStale = model.randomDistributionStale === true;
  const randomDistributionTrials = Number(randomDistribution?.trials || model.randomDistributionTrials || 0);
  const randomDistributionProgress = model.randomDistributionProgress || {};
  const randomDistributionCompleted = boundedNumber(
    randomDistributionProgress.completed || 0,
    0,
    0,
    randomDistributionTrials
  );
  const randomDistributionPercent = boundedNumber(
    randomDistributionProgress.percent ??
      (randomDistributionTrials > 0 ? (randomDistributionCompleted / randomDistributionTrials) * 100 : 0),
    randomDistributionTrials > 0 ? (randomDistributionCompleted / randomDistributionTrials) * 100 : 0,
    0,
    100
  );
  const randomDistributionError = String(model.randomDistributionError || '');
  const randomDistributionAction = !randomDistributionStale
    ? `<button type="button" class="rng-run-button" data-role="rng-run">
          ${randomDistributionError ? 'Retry' : randomDistribution ? 'Recalculate' : 'Calculate range'}
        </button>`
    : '';
  const chartSeries = model.chartSeries || null;
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
      <span class="res-val${metric.className ? ` ${escapeHtml(metric.className)}` : ''}"${metric.title ? ` title="${escapeHtml(metric.title)}" tabindex="0" aria-label="${escapeHtml(`${metric.value}: ${metric.title}`)}"` : ''}>${escapeHtml(metric.value)}</span>
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
        <p>${randomDistribution && !randomDistributionStale && !randomDistributionError ? `Simulated outcome distribution from ${number(randomDistribution.trials)} rotations (randomized inputs).` : 'See how weapon strength and supported random procs affect expected DPS.'}</p>
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
            ? `${randomDistributionRangeHtml(randomDistribution)}
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
            (group) => `<div class="res-condition-group${group.damaging ? '' : ' res-condition-group-utility'}">
          <div class="res-condition-group-title">${group.label}</div>
          <div class="res-hdr cond-hdr">
            <span>Condition</span>${group.damaging ? '<span>Damage</span><span>% Damage</span><span>DPS</span>' : ''}<span>Avg Stacks</span>
          </div>
          ${group.conditions
            .map((condition) => {
              const selectable = Boolean(chartSeries?.conditionDamage?.[condition.name]?.length);
              // Reuse the effect icon while retaining the row's keyboard-accessible tick inspector.
              const icon = MODIFIER_EFFECT_ICONS[CONDITION_ICON_LABELS[condition.name] || condition.name];
              return `<div class="res-row${selectable ? ' res-row-selectable' : ''}"${selectable ? ` role="button" tabindex="0" aria-haspopup="dialog" aria-expanded="false" aria-label="Inspect ${escapeHtml(condition.name)} ticks" data-condition-name="${escapeHtml(condition.name)}"` : ''}>
          <span class="res-skill condi">${icon ? `<img src="${escapeHtml(icon)}" alt="" />` : ''}${escapeHtml(condition.name)}</span>
          ${
            group.damaging
              ? `<span class="condi">${number(condition.damage)}</span>
          <span>${damagePercent(condition.damage).toFixed(2)}%</span>
          <span class="dps">${number(condition.dps)}</span>`
              : ''
          }
          <span>${Number(condition.averageStacks || 0).toFixed(2)}</span>
        </div>`;
            })
            .join('')}
        </div>`
          )
          .join('')}
        ${
          model.conditionTotal
            ? `<div class="res-row res-total">
          <span class="res-skill"><b>${escapeHtml(model.conditionTotal.label || 'Total Conditions')}</b></span>
          <span class="condi"><b>${number(model.conditionTotal.damage)}</b></span>
          <span><b>${damagePercent(model.conditionTotal.damage).toFixed(2)}%</b></span>
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
    model.contributions !== undefined || model.contributionsStale || model.contributionsError
      ? `<div data-role="modifier-contributions">${modifierContributionsHtml(model)}</div>`
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
    const hits = chartSeries.skillDamage?.[selectedSkillKey] || [];
    // List only activations of the selected effect so its count and sources exclude downstream procs.
    const selectedRow = skillRows.find((row) => row.key === selectedSkillKey);
    const skillName = String(selectedRow?.sourceSkill || selectedRow?.name || '');
    const applications = chartSeries.skillApplications?.[skillName] || [];
    const procs = (model.procSteps || [])
      .filter((proc) => selectedRow?.group === 'Player' && proc.skill === selectedRow.sourceSkill)
      .sort((left, right) => left.start - right.start);
    if (!hits.length && !procs.length) return;
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
    if (procs.length) {
      // Group activations by their trigger so each skill can disclose its own chronological proc times.
      const timesBySource = new Map<string, number[]>();
      for (const proc of procs) {
        const times = timesBySource.get(proc.sourceSkill) || [];
        times.push(proc.start);
        timesBySource.set(proc.sourceSkill, times);
      }

      // Scroll each timestamp list independently so trigger summaries stay outside the scrolling area.
      timeline.innerHTML = `<div data-role="skill-procs">
        <div class="chart-panel-title">Procs (${procs.length})</div>
        ${[...timesBySource]
          .map(([source, times]) => {
            const damage = selectedRow?.procDamage?.find((entry) => entry.sourceSkill === source);
            // Missing attribution remains unknown rather than estimating damage from activation counts.
            return `<details>
              <summary>${escapeHtml(source || '\u2014')} \u2014 ${times.length} ${times.length === 1 ? 'proc' : 'procs'} \u2014 (${damage ? number(damage.total) : '\u2014'} damage | ${damage ? number(damage.dps) : '\u2014'} DPS)</summary>
              <div class="hit-detail-table">
                <table>
                  <thead><tr><th scope="col">Time</th></tr></thead>
                  <tbody>${times.map((time) => `<tr><td>${(time / 1000).toFixed(2)}s</td></tr>`).join('')}</tbody>
                </table>
              </div>
            </details>`;
          })
          .join('')}
      </div>`;
    }

    if (hits.length) {
      const damageTimeline = doc.createElement('div');
      timeline.append(damageTimeline);
      // Pair strikes with their pulse applications; later condition payouts do not represent pulse empowerment.
      const empowerment = new Map(applications.map((application) => [application.t, application.empowered]));
      const pulseHits = hits.map((hit) =>
        hit.damageType !== 'condition' && empowerment.has(hit.t) ? { ...hit, empowered: empowerment.get(hit.t) } : hit
      );
      mountHitTimeline(damageTimeline, pulseHits, {
        durationMs: chartSeries.durationMs,
        color: options.chartOptions?.skillDamageColor,
        label: 'Damage Events'
      });
    }
  };

  const selectSkill = (key: string | null): void => {
    // Keep hit inspection local to the expanded row; clicking it again clears the selection.
    selectedSkillKey = key && key === selectedSkillKey ? null : key;
    applySkillRowSelection();
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
    mountTimeSeriesCharts(chartContainer, chartSeries, {
      ...(options.chartOptions || {}),
      healthBreakpoints: breakpoints
    });
  }

  bindSkillSelection();
  // A viewport-sized inspector keeps attribution readable independently of the narrow condition column.
  let selectedCondition: string | null = null;
  const conditionRows = container.querySelectorAll<HTMLElement>('[data-condition-name]');
  const selectCondition = (row: HTMLElement): void => {
    const name = row.dataset.conditionName!;
    selectedCondition = selectedCondition === name ? null : name;
    container.querySelector<HTMLDialogElement>('[data-role="condition-inspector"]')?.close();
    for (const conditionRow of conditionRows) {
      const active = conditionRow.dataset.conditionName === selectedCondition;
      conditionRow.classList.toggle('res-row-selected', active);
      conditionRow.setAttribute('aria-expanded', String(active));
    }

    if (!selectedCondition || !chartSeries) return;
    const dialog = container.ownerDocument.createElement('dialog');
    dialog.className = 'condition-inspector';
    dialog.dataset.role = 'condition-inspector';
    dialog.setAttribute('aria-label', `${name} damage inspector`);
    dialog.innerHTML = `<div class="condition-inspector-heading"><div><h2>${escapeHtml(name)} damage</h2></div><button type="button" class="hit-detail-close" data-dialog-close aria-label="Close condition inspector" autofocus>Close</button></div>`;
    const timeline = container.ownerDocument.createElement('div');
    timeline.className = 'condition-inspector-body';
    timeline.dataset.role = 'condition-timeline';
    timeline.setAttribute('role', 'region');
    timeline.setAttribute('aria-label', `${name} damage ticks`);
    dialog.append(timeline);
    container.append(dialog);
    bindDialog(dialog);
    dialog.addEventListener(
      'close',
      () => {
        selectedCondition = null;
        row.classList.remove('res-row-selected');
        row.setAttribute('aria-expanded', 'false');
        dialog.remove();
        row.focus({ preventScroll: true });
      },
      { once: true }
    );
    showDialog(dialog);
    mountHitTimeline(timeline, chartSeries.conditionDamage?.[name] || [], {
      durationMs: chartSeries.durationMs,
      color: options.chartOptions?.skillDamageColor,
      label: `${name} damage · fight time`,
      timeLabel: 'fight time',
      inspectAllTicks: true
    });
  };

  for (const row of conditionRows) {
    row.onclick = () => selectCondition(row);
    row.onkeydown = (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectCondition(row);
      }
    };
  }

  const runRandomDistribution = container.querySelector<HTMLElement>('[data-role="rng-run"]');
  if (runRandomDistribution && typeof options.onRunRandomDistribution === 'function') {
    runRandomDistribution.onclick = () => {
      options.onRunRandomDistribution?.();
    };
  }

  return { getSortState: () => ({ ...sortState }), renderSortedRows };
}
