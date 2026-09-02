import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { renderReact } from '#ui/react-root.js';
import type { ChartOptions, ChartSeries } from '#gw2/app/presentation/results/charts/time-series.js';
import { mountTimeSeriesCharts } from '#gw2/app/presentation/results/charts/time-series.js';
import { mountHitTimeline } from '#ui/results/charts/hit-timeline.js';
import type { RelicComparisonModel } from '#gw2/app/presentation/results/charts/relic-comparison.js';
import { mountRelicComparisonChart } from '#gw2/app/presentation/results/charts/relic-comparison.js';
import { RotationLoopAnalysisView } from '#gw2/app/rotation/result/loop-analysis-view.js';
import type { RotationLoopAnalysis } from '#gw2/app/rotation/result/loop-analysis.js';
import type { ProfessionAppState } from '#gw2/app/types.js';

export { SKILL_COLS } from '#gw2/app/presentation/results/result-columns.js';

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
}

export interface RotationResultsOptions {
  readonly resolveSkillIcon?: (row: ResultRow) => string;
  readonly placeholderIcon?: string;
  readonly skillBreakdownClassName?: string;
  readonly chartOptions?: Partial<ChartOptions>;
  readonly resultRevision?: number;
  readonly sortState?: Partial<ResultSortState>;
  readonly onSortStateChange?: (state: ResultSortState) => unknown;
  readonly onRunRandomDistribution?: () => unknown;
  readonly onRunRelicComparison?: () => unknown;
  readonly loadLoopAnalysis?: () => RotationLoopAnalysis;
  readonly loopApp?: ProfessionAppState;
}

export function nextResultSortState(
  currentColumn: string | null,
  currentDirection: ResultSortDirection,
  column: string
): ResultSortState {
  // Repeated clicks cycle descending -> ascending -> default total ordering.
  if (currentColumn !== column) return { column, direction: 'desc' };
  const direction: ResultSortDirection =
    currentDirection === 'desc' ? 'asc' : currentDirection === 'asc' ? null : 'desc';
  return { column: direction ? column : null, direction };
}

export function sortResultRows(
  rows: readonly ResultRow[],
  columns: readonly ResultColumn[],
  column: string | null,
  direction: ResultSortDirection
): ResultRow[] {
  // Never mutate the model supplied by the simulation/result transformer.
  const sorted = [...rows];
  if (!column || !direction) return sorted.sort((left, right) => Number(right.total || 0) - Number(left.total || 0));
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

function MetricInfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox='0 0 24 24' aria-hidden='true'>
      <circle cx='12' cy='12' r='9' />
      <line x1='12' x2='12' y1='11' y2='17' />
      <line x1='12' x2='12.01' y1='7' y2='7' />
    </svg>
  );
}

function SnapshotIcon() {
  return (
    <svg viewBox='0 0 24 24' aria-hidden='true'>
      <polyline points='3 17 9 11 13 15 21 7' />
      <polyline points='15 7 21 7 21 13' />
    </svg>
  );
}

function MetricDetails({
  id,
  metric,
  openDisclosure,
  setOpenDisclosure
}: {
  id: string;
  metric: ResultMetric;
  openDisclosure: string | null;
  setOpenDisclosure: (id: string | null) => void;
}) {
  const details = metric.details || [];
  if (!details.length) return null;
  const title = `${metric.label} breakdown`;
  return (
    <details
      className='res-metric-info'
      open={openDisclosure === id}
      onToggle={(event) =>
        setOpenDisclosure(event.currentTarget.open ? id : openDisclosure === id ? null : openDisclosure)
      }
    >
      <summary aria-label={`Show ${title}`} title={`Show ${title}`}>
        <MetricInfoIcon />
      </summary>
      <div className='res-metric-info-panel'>
        <strong>{title}</strong>
        <dl>
          {details.map((detail) => (
            <div key={detail.label}>
              <dt>{detail.label}</dt>
              <dd>{String(detail.value ?? '')}</dd>
            </div>
          ))}
        </dl>
      </div>
    </details>
  );
}

function DpsSnapshots({
  breakpoints,
  id,
  metric,
  openDisclosure,
  setOpenDisclosure
}: {
  breakpoints: readonly ResultBreakpoint[];
  id: string;
  metric: ResultMetric;
  openDisclosure: string | null;
  setOpenDisclosure: (id: string | null) => void;
}) {
  return (
    <div className='res-label-row'>
      <details
        className='res-dps-snapshots'
        open={openDisclosure === id}
        onToggle={(event) =>
          setOpenDisclosure(event.currentTarget.open ? id : openDisclosure === id ? null : openDisclosure)
        }
      >
        <summary aria-label='Show DPS snapshots' title='Show DPS snapshots'>
          <span className='res-label'>{metric.label}</span>
          <MetricInfoIcon className='res-dps-snapshots-info' />
          <span className='res-dps-snapshots-chevron' aria-hidden='true' />
        </summary>
        <div className='res-dps-snapshots-panel'>
          <div className='res-dps-snapshots-heading'>
            <SnapshotIcon />
            <strong>DPS snapshots</strong>
          </div>
          <div className='res-dps-snapshots-list'>
            {breakpoints.map((breakpoint) => (
              <div className='res-dps-snapshot' key={breakpoint.healthPercent}>
                <span className='res-dps-snapshot-health'>
                  <b>{number(breakpoint.healthPercent)}%</b> target health
                </span>
                <strong>
                  {number(breakpoint.dps)} <small>DPS</small>
                </strong>
                <span className='res-dps-snapshot-time'>at {Number(breakpoint.elapsed || 0).toFixed(2)}s</span>
              </div>
            ))}
          </div>
        </div>
      </details>
      <MetricDetails
        id={`${id}:details`}
        metric={metric}
        openDisclosure={openDisclosure}
        setOpenDisclosure={setOpenDisclosure}
      />
    </div>
  );
}

/** Closes open metric disclosures unless the click occurred inside that same disclosure. */
export function dismissResultMetricDetails(root: ParentNode, target: EventTarget | null): void {
  for (const details of root.querySelectorAll<HTMLDetailsElement>('.res-metric-info[open], .res-dps-snapshots[open]')) {
    if (target && details.contains(target as Node)) continue;
    details.open = false;
  }
}

function ResultSummary({
  breakpoints,
  metrics,
  placeholder
}: {
  breakpoints: readonly ResultBreakpoint[];
  metrics: readonly ResultMetric[];
  placeholder: boolean;
}) {
  const [openDisclosure, setOpenDisclosure] = useState<string | null>(null);
  useEffect(() => {
    if (!openDisclosure) return;
    const dismiss = (event: PointerEvent): void => {
      const target = event.target;
      if (target instanceof Element && target.closest('.res-metric-info, .res-dps-snapshots')) return;
      setOpenDisclosure(null);
    };

    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [openDisclosure]);

  return (
    <div
      className={`res-summary${placeholder ? ' res-summary-placeholder' : ''}`}
      aria-label={placeholder ? 'Rotation metrics unavailable until skills are added' : undefined}
    >
      {metrics.map((metric, index) => {
        const startsTargetGroup = metric.group === 'target' && metrics[index - 1]?.group !== 'target';
        const disclosureId = `metric:${index}`;
        return (
          <div
            className={`res-stat${metric.group === 'target' ? ' res-stat-target' : ''}${startsTargetGroup ? ' res-stat-target-start' : ''}`}
            key={`${metric.group || 'player'}:${metric.label}`}
          >
            {breakpoints.length && metric.className === 'dps' ? (
              <DpsSnapshots
                breakpoints={breakpoints}
                id={disclosureId}
                metric={metric}
                openDisclosure={openDisclosure}
                setOpenDisclosure={setOpenDisclosure}
              />
            ) : (
              <div className='res-label-row'>
                <span className='res-label'>{metric.label}</span>
                <MetricDetails
                  id={disclosureId}
                  metric={metric}
                  openDisclosure={openDisclosure}
                  setOpenDisclosure={setOpenDisclosure}
                />
              </div>
            )}
            <span className={`res-val${metric.className ? ` ${metric.className}` : ''}`}>
              {String(metric.value ?? '')}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function RandomDistribution({ model, onRun }: { model: RotationResultsModel; onRun?: () => unknown }) {
  const distribution = model.randomDistribution || null;
  const stale = model.randomDistributionStale === true;
  const error = String(model.randomDistributionError || '');
  const trials = Number(distribution?.trials || model.randomDistributionTrials || 0);
  const completed = Math.max(0, Math.min(trials, Number(model.randomDistributionProgress?.completed || 0)));
  const percent = Math.max(
    0,
    Math.min(100, Number(model.randomDistributionProgress?.percent ?? (trials > 0 ? (completed / trials) * 100 : 0)))
  );
  const explanation = distribution?.explanation;
  const cohort = Math.max(1, Math.round(explanation?.cohortPercent || 10));
  const cohortSize = Math.max(1, Math.ceil(trials * (cohort / 100)));

  return (
    <section className='rng-distribution'>
      <div className='rng-distribution-heading'>
        <div>
          <h4>Randomized DPS range</h4>
          <p>See how weapon strength and supported random procs affect expected DPS.</p>
        </div>
        <div className='rng-distribution-heading-actions'>
          {trials ? <span>{number(trials)} simulations</span> : null}
          {!stale ? (
            <button type='button' className='rng-run-button' data-role='rng-run' onClick={onRun}>
              {error ? 'Retry' : distribution ? 'Recalculate' : 'Calculate range'}
            </button>
          ) : null}
        </div>
      </div>
      {stale ? (
        <div
          className='rng-distribution-progress'
          data-role='rng-progress'
          role='progressbar'
          aria-label='Calculating randomized DPS range'
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(percent)}
        >
          <div className='rng-distribution-progress-track'>
            <span data-role='rng-progress-bar' style={{ width: `${percent}%` }} />
          </div>
          <span data-role='rng-progress-label'>
            {number(completed)} / {number(trials)} simulations ({Math.round(percent)}%)
          </span>
        </div>
      ) : error ? (
        <div className='rng-distribution-status rng-distribution-error'>{error}</div>
      ) : distribution ? (
        <>
          <div className='rng-distribution-grid'>
            {[
              ['Expected', distribution.mean, 'Mean DPS', ''],
              ['Typical', distribution.p50, 'P50 DPS', ''],
              [
                'Likely range',
                `${number(distribution.p10)}–${number(distribution.p90)}`,
                'P10–P90 DPS',
                'rng-distribution-range'
              ],
              ['Rare low outcome', distribution.p01, 'About 1 in 100 runs are lower', 'rng-unlucky'],
              ['Rare high outcome', distribution.p99, 'About 1 in 100 runs are higher', 'rng-lucky']
            ].map(([label, value, caption, className]) => (
              <div className={`rng-distribution-stat${className ? ` ${className}` : ''}`} key={String(label)}>
                <span>{label}</span>
                <strong>{typeof value === 'string' ? value : number(value)}</strong>
                <small>{caption}</small>
              </div>
            ))}
          </div>
          {explanation?.drivers?.length ? (
            <div className='rng-explanation'>
              <div className='rng-explanation-heading'>
                <strong>What was different in the highest-DPS simulations?</strong>
                <span>
                  {number(cohortSize)} highest vs {number(cohortSize)} lowest
                </span>
              </div>
              <p>
                The {number(cohortSize)} highest-DPS simulations averaged {number(explanation.highDpsMean)} DPS. The{' '}
                {number(cohortSize)} lowest-DPS simulations averaged {number(explanation.lowDpsMean)} DPS.
              </p>
              <div className='rng-driver-list'>
                {explanation.drivers.map((driver) => (
                  <div className='rng-driver' key={driver.id}>
                    <span className='rng-driver-label'>
                      <strong>{driver.label}</strong>
                      <small>
                        Highest-DPS group: {randomDriverNumber(driver.highAverage, driver.unit)} average per simulation
                      </small>
                      <small>
                        Lowest-DPS group: {randomDriverNumber(driver.lowAverage, driver.unit)} average per simulation
                      </small>
                    </span>
                    <span className='rng-driver-delta'>
                      <strong>
                        {Number(driver.delta) >= 0 ? '+' : '−'}
                        {randomDriverNumber(Math.abs(driver.delta), driver.unit)}
                      </strong>
                      <small>difference</small>
                    </span>
                    <span className='rng-driver-impact'>
                      <strong>≈ {signedInteger(driver.estimatedDpsDelta)} DPS</strong>
                      <small>estimated DPS difference</small>
                    </span>
                  </div>
                ))}
              </div>
              <p className='rng-explanation-note'>
                These are averages across each group, not counts from one simulation. DPS differences are
                single-variable trend estimates across all outcomes. Related rows can come from the same proc chain, so
                do not add them together.
              </p>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function SkillCell({
  column,
  options,
  row
}: {
  column: ResultColumn;
  options: RotationResultsOptions;
  row: ResultRow;
}) {
  const value = row[column.key];
  if (column.key === 'name') {
    const icon = options.resolveSkillIcon?.(row) || options.placeholderIcon || '';
    return (
      <span className='res-skill'>
        {icon ? <img src={icon} alt='' /> : null}
        {String(value ?? '')}
      </span>
    );
  }

  const formatted = column.format
    ? String(column.format(value, row))
    : value == null
      ? '—'
      : column.numeric
        ? number(value)
        : String(value);
  return (
    <span className={column.className || undefined} title={column.title?.(value, row) || undefined}>
      {formatted}
    </span>
  );
}

function HitTimelineLeaf({
  hits,
  model,
  revision
}: {
  hits: NonNullable<ChartSeries['skillDamage']>[string];
  model: ChartSeries;
  revision: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const latest = useRef({ hits, model });
  latest.current = { hits, model };
  useEffect(() => {
    const { hits: currentHits, model: currentModel } = latest.current;
    const handle = mountHitTimeline(ref.current, currentHits, {
      durationMs: currentModel.durationMs,
      label: 'Damage Events'
    });
    return () => handle?.destroy();
  }, [revision]);
  return <div className='res-skill-timeline' data-role='skill-timeline' ref={ref} />;
}

function SkillRows({
  chartSeries,
  columns,
  options,
  rows,
  selectedKey,
  setSelectedKey
}: {
  chartSeries: ChartSeries | null;
  columns: readonly ResultColumn[];
  options: RotationResultsOptions;
  rows: readonly ResultRow[];
  selectedKey: string | null;
  setSelectedKey: (key: string | null) => void;
}) {
  const renderRow = (row: ResultRow, index: number) => {
    const skillKey = typeof row.key === 'string' ? row.key : '';
    const selected = Boolean(skillKey && selectedKey === skillKey);
    const hits = skillKey ? chartSeries?.skillDamage?.[skillKey] : undefined;
    return (
      <Fragment key={skillKey || `${row.name}:${index}`}>
        <div
          className={`res-row${skillKey ? ' res-row-selectable' : ''}${selected ? ' res-row-selected' : ''}`}
          data-skill-key={skillKey || undefined}
          role={skillKey ? 'button' : undefined}
          tabIndex={skillKey ? 0 : undefined}
          aria-pressed={skillKey ? selected : undefined}
          onClick={skillKey ? () => setSelectedKey(selected ? null : skillKey) : undefined}
          onKeyDown={
            skillKey
              ? (event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  setSelectedKey(selected ? null : skillKey);
                }
              : undefined
          }
        >
          {columns.map((column) => (
            <SkillCell column={column} options={options} row={row} key={column.key} />
          ))}
        </div>
        {selected && hits?.length && chartSeries ? (
          <HitTimelineLeaf hits={hits} model={chartSeries} revision={options.resultRevision || 0} key={skillKey} />
        ) : null}
      </Fragment>
    );
  };

  const hasGroups = rows.some((row) => typeof row.group === 'string' && row.group.trim());
  if (!hasGroups) return <>{rows.map(renderRow)}</>;
  const grouped = new Map<string, ResultRow[]>();
  for (const row of rows) {
    const group = typeof row.group === 'string' && row.group.trim() ? row.group.trim() : 'Other';
    grouped.set(group, [...(grouped.get(group) || []), row]);
  }

  const preferredOrder = new Map([
    ['Player', 0],
    ['Entities', 1],
    ['Environment', 2],
    ['Other', 3]
  ]);
  const names = [...grouped.keys()].sort(
    (left, right) => (preferredOrder.get(left) ?? 3) - (preferredOrder.get(right) ?? 3)
  );
  const summaryColumns = new Set(['strike', 'condition', 'total', 'dps']);
  return (
    <>
      {names.map((group) => {
        const groupRows = grouped.get(group) || [];
        return (
          <Fragment key={group}>
            <div className='res-skill-group-heading' data-skill-group={group}>
              {columns.map((column) => {
                if (column.key === 'name')
                  return (
                    <span className='res-skill-group-name' key={column.key}>
                      {group}
                    </span>
                  );
                if (!summaryColumns.has(column.key)) return <span aria-hidden='true' key={column.key} />;
                const total = groupRows.reduce((sum, row) => sum + Number(row[column.key] || 0), 0);
                return (
                  <span
                    className={`res-skill-group-total${column.className ? ` ${column.className}` : ''}`}
                    aria-label={`${group} ${column.label || column.key}: ${number(total)}`}
                    key={column.key}
                  >
                    {number(total)}
                  </span>
                );
              })}
            </div>
            {groupRows.map(renderRow)}
          </Fragment>
        );
      })}
    </>
  );
}

function Breakdown({
  model,
  options,
  selectedKey,
  setSelectedKey
}: {
  model: RotationResultsModel;
  options: RotationResultsOptions;
  selectedKey: string | null;
  setSelectedKey: (key: string | null) => void;
}) {
  const columns = useMemo(() => model.skillColumns || [], [model.skillColumns]);
  const [sortState, setSortState] = useState<ResultSortState>({
    column: options.sortState?.column || null,
    direction: options.sortState?.direction || null
  });
  const rows = useMemo(
    () => sortResultRows(model.skillRows || [], columns, sortState.column, sortState.direction),
    [columns, model.skillRows, sortState.column, sortState.direction]
  );
  const setSort = (column: string): void => {
    const next = nextResultSortState(sortState.column, sortState.direction, column);
    setSortState(next);
    options.onSortStateChange?.(next);
  };

  return (
    <section className='res-breakdown-section'>
      <div className='res-breakdown'>
        {columns.length ? (
          <>
            <div className='res-section-title'>Damage Breakdown</div>
            <div className={options.skillBreakdownClassName || 'skill-breakdown'} data-role='skill-breakdown'>
              <div className='res-hdr res-hdr-sortable' data-role='skill-header'>
                {columns.map((column) => (
                  <span
                    data-sort-col={column.key}
                    role='button'
                    tabIndex={0}
                    onClick={() => setSort(column.key)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      setSort(column.key);
                    }}
                    key={column.key}
                  >
                    {column.label || column.key}
                    {sortState.column === column.key ? (sortState.direction === 'asc' ? ' ▲' : ' ▼') : ''}
                  </span>
                ))}
              </div>
              <div className='res-skill-rows' data-role='skill-rows'>
                <SkillRows
                  chartSeries={model.chartSeries || null}
                  columns={columns}
                  options={options}
                  rows={rows}
                  selectedKey={selectedKey}
                  setSelectedKey={setSelectedKey}
                />
              </div>
            </div>
          </>
        ) : null}
        {model.conditions?.length ? (
          <>
            <div className='res-section-title'>Conditions</div>
            <div className='cond-breakdown'>
              <div className='res-hdr cond-hdr'>
                <span>Condition</span>
                <span>Damage</span>
                <span>DPS</span>
                <span>Avg Stacks</span>
              </div>
              {model.conditions.map((condition) => (
                <div className='res-row' key={condition.name}>
                  <span className='res-skill condi'>{condition.name}</span>
                  <span className='condi'>{number(condition.damage)}</span>
                  <span className='dps'>{number(condition.dps)}</span>
                  <span>{Number(condition.averageStacks || 0).toFixed(2)}</span>
                </div>
              ))}
              {model.conditionTotal ? (
                <div className='res-row res-total'>
                  <span className='res-skill'>
                    <b>{model.conditionTotal.label || 'Total Conditions'}</b>
                  </span>
                  <span className='condi'>
                    <b>{number(model.conditionTotal.damage)}</b>
                  </span>
                  <span className='dps'>
                    <b>{number(model.conditionTotal.dps)}</b>
                  </span>
                  <span />
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}

function TimeSeriesLeaf({
  model,
  options,
  revision,
  selectedKey
}: {
  model: ChartSeries;
  options: Partial<ChartOptions>;
  revision: number;
  selectedKey: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const handle = useRef<ReturnType<typeof mountTimeSeriesCharts>>(null);
  const latest = useRef({ model, options });
  latest.current = { model, options };
  useEffect(() => {
    handle.current = mountTimeSeriesCharts(ref.current, latest.current.model, latest.current.options);
    return () => {
      handle.current?.destroy();
      handle.current = null;
    };
  }, [revision]);
  useEffect(() => handle.current?.setSelectedSkill(selectedKey), [selectedKey]);
  return <div data-role='result-charts' ref={ref} />;
}

function RelicComparison({ model, options }: { model: RotationResultsModel; options: RotationResultsOptions }) {
  const comparison = model.relicComparison || null;
  const opponent = String(model.relicComparisonOpponent || '');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!comparison) return;
    return (
      mountRelicComparisonChart(ref.current, comparison, {
        opponentLabel: opponent ? `Relic of ${opponent}` : undefined
      }) || undefined
    );
  }, [comparison, opponent]);
  const error = String(model.relicComparisonError || '');
  const stale = model.relicComparisonStale === true;
  return (
    <section className='relic-cmp'>
      <div className='relic-cmp-heading'>
        <div>
          <h4>Relic of Thorns break-even</h4>
          <p>
            Relic of Thorns ramps its Condition Damage over ~48s. Run a second simulation to see the fight duration at
            which it overtakes {opponent ? `Relic of ${opponent}` : 'your equipped relic'}.
          </p>
        </div>
        {!stale && (comparison || error) ? (
          <div className='relic-cmp-heading-actions'>
            <button
              type='button'
              className='relic-cmp-run-button'
              data-role='relic-comparison-run'
              onClick={options.onRunRelicComparison}
            >
              {error ? 'Retry' : 'Run again'}
            </button>
          </div>
        ) : null}
      </div>
      {stale ? (
        <div className='relic-cmp-status' role='status'>
          Running comparison simulation…
        </div>
      ) : error ? (
        <div className='relic-cmp-status relic-cmp-error'>{error}</div>
      ) : comparison ? (
        <div ref={ref} />
      ) : (
        <div className='relic-cmp-manual'>
          <span>Off by default to avoid a second simulation on every edit.</span>
          <button
            type='button'
            className='relic-cmp-run-button'
            data-role='relic-comparison-run'
            onClick={options.onRunRelicComparison}
          >
            Run comparison
          </button>
        </div>
      )}
    </section>
  );
}

function Contributions({ model }: { model: RotationResultsModel }) {
  const contributions = model.contributions || [];
  const stale = model.contributionsStale === true;
  const error = String(model.contributionsError || '');
  return (
    <div className='res-contributions'>
      <h4>
        <span>Modifier Contributions</span>
        {stale ? <span className='contrib-status'>Recalculating</span> : null}
      </h4>
      <p className='contrib-disclaimer'>
        Values are estimated by disabling each modifier and rerunning the simulation. They may be misleading if doing so
        breaks the rotation.
      </p>
      {contributions.length ? (
        <div className='contrib-table'>
          <div className='contrib-hdr'>
            <span>Modifier</span>
            <span>DPS Increase</span>
            <span>% Increase</span>
          </div>
          {contributions.map((contribution) => (
            <div className='contrib-row' key={contribution.name}>
              <span className='contrib-name'>
                {contribution.icon ? <img src={contribution.icon} alt='' /> : null}
                {contribution.name}
              </span>
              <span className='contrib-val'>{signedInteger(contribution.dpsIncrease)}</span>
              <span className='contrib-pct'>{signedFixed(contribution.pctIncrease)}%</span>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className='contrib-pending contrib-error'>{error}</div>
      ) : (
        <div className='contrib-pending'>Calculating modifier contributions…</div>
      )}
    </div>
  );
}

/** Renders GW2 result tables and controls while chart implementations remain bounded imperative leaves. */
function RotationResults({ model, options }: { model: RotationResultsModel; options: RotationResultsOptions }) {
  const [selectedSkillKey, setSelectedSkillKey] = useState<string | null>(null);
  const metrics = model.metrics || [];
  const breakpoints = model.breakpoints || [];
  const hasBreakdown = Boolean(model.skillColumns?.length || model.conditions?.length);
  const hasContributions = Boolean(model.contributions?.length || model.contributionsStale || model.contributionsError);
  return (
    <>
      {model.showSummary !== false ? (
        <ResultSummary metrics={metrics} breakpoints={breakpoints} placeholder={model.summaryPlaceholder === true} />
      ) : null}
      {model.randomDistributionRequested ? (
        <RandomDistribution model={model} onRun={options.onRunRandomDistribution} />
      ) : null}
      {hasBreakdown ? (
        <Breakdown
          model={model}
          options={options}
          selectedKey={selectedSkillKey}
          setSelectedKey={setSelectedSkillKey}
        />
      ) : null}
      {model.chartSeries ? (
        <TimeSeriesLeaf
          model={model.chartSeries}
          options={{ ...(options.chartOptions || {}), healthBreakpoints: breakpoints }}
          revision={options.resultRevision || 0}
          selectedKey={selectedSkillKey}
        />
      ) : null}
      {model.relicComparisonAvailable ? <RelicComparison model={model} options={options} /> : null}
      {hasContributions ? <Contributions model={model} /> : null}
      {options.loadLoopAnalysis && options.loopApp ? (
        <RotationLoopAnalysisView analysis={options.loadLoopAnalysis()} app={options.loopApp} />
      ) : null}
    </>
  );
}

/** Retains the existing renderer entry point while React owns every descendant of the results container. */
export function mountRotationResults(
  container: HTMLElement | null | undefined,
  model: RotationResultsModel = {},
  options: RotationResultsOptions = {}
): void {
  if (container) renderReact(container, <RotationResults model={model} options={options} />);
}
