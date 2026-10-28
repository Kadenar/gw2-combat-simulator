import { resultNumber as number } from '#gw2/app/results/formatting.js';
import { ACTOR } from '#gw2/platform/constants.js';
import { escapeHtml } from '#ui/shared/html.js';

// Trusted static disclosure glyph (Lucide trend line).
const DPS_SNAPSHOTS_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="15 7 21 7 21 13"/></svg>`;

const metricDetailsDismissalRoots = new WeakSet<Document>();

export interface ResultMetric {
  readonly title?: string;
  readonly label: string;
  readonly value: unknown;
  readonly className?: string;
  readonly group?: typeof ACTOR.PLAYER | 'target';
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
}

export interface ResultDpsSnapshot {
  readonly label: string;
  readonly detail: string;
  readonly dps: number;
  readonly elapsed: number;
}

export interface ResultSummaryModel {
  readonly metrics: readonly ResultMetric[];
  readonly summaryPlaceholder?: boolean;
  readonly breakpoints?: readonly ResultBreakpoint[];
  readonly phaseSnapshots?: readonly ResultDpsSnapshot[];
}

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

/** Health ranges and encounter phases share the existing DPS disclosure rather than adding result rows. */
// Preserve milliseconds so breakpoint times can be compared with individual hits.
function resultDpsSnapshotsHtml(metric: ResultMetric, snapshots: readonly ResultDpsSnapshot[], title: string): string {
  return `<div class="res-label-row">
    <details class="res-dps-snapshots">
      <summary aria-label="Show ${escapeHtml(title)}" title="Show ${escapeHtml(title)}">
        <span class="res-label">${escapeHtml(metric.label)}</span>
        <svg class="res-dps-snapshots-info" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><line x1="12" x2="12" y1="11" y2="17"/><line x1="12" x2="12.01" y1="7" y2="7"/></svg>
        <span class="res-dps-snapshots-chevron" aria-hidden="true"></span>
      </summary>
      <div class="res-dps-snapshots-panel">
        <div class="res-dps-snapshots-heading">${DPS_SNAPSHOTS_ICON}<strong>${escapeHtml(title)}</strong></div>
        <div class="res-dps-snapshots-list">
          ${snapshots
            .map(
              (snapshot) => `<div class="res-dps-snapshot">
            <span class="res-dps-snapshot-health"><b>${escapeHtml(snapshot.label)}</b> ${escapeHtml(snapshot.detail)}</span>
            <strong>${number(snapshot.dps)} <small>DPS</small></strong>
            <span class="res-dps-snapshot-time">at ${Number(snapshot.elapsed || 0).toFixed(3)}s</span>
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

/** Appends summary metrics and binds document-wide dismissal for both the summary and its Analysis mirror. */
export function mountResultSummary(container: HTMLElement | null | undefined, model: ResultSummaryModel): void {
  if (!container) return;

  bindResultMetricDetailsDismissal(container);
  const { metrics, summaryPlaceholder = false, breakpoints = [], phaseSnapshots } = model;
  const snapshots =
    phaseSnapshots ??
    breakpoints.map((breakpoint) => ({
      label: `${number(breakpoint.healthPercent)}%`,
      detail: 'target health',
      dps: breakpoint.dps,
      elapsed: breakpoint.elapsed
    }));
  container.insertAdjacentHTML(
    'beforeend',
    `<div class="res-summary${summaryPlaceholder ? ' res-summary-placeholder' : ''}"${
      summaryPlaceholder ? ' aria-label="Rotation metrics unavailable until skills are added"' : ''
    }>
    ${metrics
      .map((metric, index) => {
        // The first target-owned metric creates a right-anchored group distinct from player attribution.
        const startsTargetGroup = metric.group === 'target' && metrics[index - 1]?.group !== 'target';
        return `<div class="res-stat${metric.group === 'target' ? ' res-stat-target' : ''}${startsTargetGroup ? ' res-stat-target-start' : ''}">
      ${snapshots.length && metric.className === 'dps' ? resultDpsSnapshotsHtml(metric, snapshots, phaseSnapshots ? 'Phase DPS' : 'DPS snapshots') : `<div class="res-label-row"><span class="res-label">${escapeHtml(metric.label)}</span>${resultMetricDetailsHtml(metric)}</div>`}
      <span class="res-val${metric.className ? ` ${escapeHtml(metric.className)}` : ''}"${metric.title ? ` title="${escapeHtml(metric.title)}" tabindex="0" aria-label="${escapeHtml(`${metric.value}: ${metric.title}`)}"` : ''}>${escapeHtml(metric.value)}</span>
    </div>`;
      })
      .join('')}
  </div>`
  );
}
