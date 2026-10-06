import { escapeHtml } from '#ui/shared/html.js';
import { resultNumber as number } from '#gw2/app/results/formatting.js';
// Trusted static disclosure glyph (Lucide trend line).
const DPS_SNAPSHOTS_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="15 7 21 7 21 13"/></svg>`;

const metricDetailsDismissalRoots = new WeakSet<Document>();

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

export interface ResultSummaryModel {
  readonly metrics: readonly ResultMetric[];
  readonly summaryPlaceholder?: boolean;
  readonly breakpoints?: readonly ResultBreakpoint[];
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

/** Anchors target-health DPS snapshots to the DPS metric so they do not consume a separate result row. */
// Preserve milliseconds so breakpoint times can be compared with individual hits.
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
            <span class="res-dps-snapshot-time">at ${Number(breakpoint.elapsed || 0).toFixed(3)}s</span>
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
  const { metrics, summaryPlaceholder = false, breakpoints = [] } = model;
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
      ${breakpoints.length && metric.className === 'dps' ? resultDpsSnapshotsHtml(metric, breakpoints) : `<div class="res-label-row"><span class="res-label">${escapeHtml(metric.label)}</span>${resultMetricDetailsHtml(metric)}</div>`}
      <span class="res-val${metric.className ? ` ${escapeHtml(metric.className)}` : ''}"${metric.title ? ` title="${escapeHtml(metric.title)}" tabindex="0" aria-label="${escapeHtml(`${metric.value}: ${metric.title}`)}"` : ''}>${escapeHtml(metric.value)}</span>
    </div>`;
      })
      .join('')}
  </div>`
  );
}
