import { escapeHtml } from './shared/html.js';

export interface SimulationMetricViewModel {
  readonly label: string;
  readonly value: unknown;
  readonly className?: string;
}

export interface SimulationTableViewModel {
  readonly kind: 'table';
  readonly title: string;
  readonly columns: readonly { readonly key: string; readonly label: string }[];
  readonly rows: readonly Readonly<Record<string, unknown>>[];
}

export interface SimulationTimelineViewModel {
  readonly kind: 'timeline';
  readonly title: string;
  readonly durationMs: number;
  readonly points: readonly { readonly atMs: number; readonly label: string }[];
}

export interface SimulationEffectLanesViewModel {
  readonly kind: 'effect-lanes';
  readonly title: string;
  readonly lanes: readonly {
    readonly label: string;
    readonly intervals: readonly { readonly startMs: number; readonly endMs: number }[];
  }[];
}

export interface SimulationWarningsViewModel {
  readonly kind: 'warnings';
  readonly title: string;
  readonly warnings: readonly string[];
}

export interface SimulationStateSnapshotViewModel {
  readonly kind: 'state-snapshot';
  readonly title: string;
  readonly entries: readonly { readonly label: string; readonly value: unknown }[];
}

export interface SimulationExtensionViewModel {
  readonly kind: 'extension';
  mount(container: HTMLElement): void;
}

export type SimulationPanelViewModel =
  | SimulationTableViewModel
  | SimulationTimelineViewModel
  | SimulationEffectLanesViewModel
  | SimulationWarningsViewModel
  | SimulationStateSnapshotViewModel
  | SimulationExtensionViewModel;

export interface SimulationViewSection {
  readonly metrics?: readonly SimulationMetricViewModel[];
  readonly summaryPlaceholder?: boolean;
  readonly panels?: readonly SimulationPanelViewModel[];
}

/** Complete shell-facing projection; games may add extension panels without changing neutral contracts. */
export interface SimulationViewModel {
  readonly summary: SimulationViewSection;
  readonly workspace: SimulationViewSection | null;
  readonly analysis: SimulationViewSection | null;
  readonly floatingDps?: string | null;
  readonly analysisEmptyHtml?: string;
  readonly onAnalysisEmpty?: (container: HTMLElement) => void;
  readonly afterAnalysisRender?: (container: HTMLElement) => void;
}

function number(value: number): string {
  return Number(value || 0).toLocaleString();
}

function panelHtml(panel: Exclude<SimulationPanelViewModel, SimulationExtensionViewModel>): string {
  if (panel.kind === 'table') {
    return `<section class="sim-panel sim-table"><h4>${escapeHtml(panel.title)}</h4>
      <div role="table"><div role="row" class="sim-table-header">${panel.columns
        .map((column) => `<span role="columnheader">${escapeHtml(column.label)}</span>`)
        .join('')}</div>${panel.rows
        .map(
          (row) =>
            `<div role="row">${panel.columns
              .map((column) => `<span role="cell">${escapeHtml(row[column.key])}</span>`)
              .join('')}</div>`
        )
        .join('')}</div></section>`;
  }

  if (panel.kind === 'timeline') {
    const duration = Math.max(1, Number(panel.durationMs || 0));
    return `<section class="sim-panel sim-timeline"><h4>${escapeHtml(panel.title)}</h4><div class="sim-timeline-track">${panel.points
      .map(
        (point) =>
          `<span class="sim-timeline-point" style="left:${Math.max(0, Math.min(100, (point.atMs / duration) * 100))}%" title="${escapeHtml(point.label)} at ${number(point.atMs)}ms"></span>`
      )
      .join('')}</div></section>`;
  }

  if (panel.kind === 'effect-lanes') {
    const duration = Math.max(1, ...panel.lanes.flatMap(({ intervals }) => intervals.map(({ endMs }) => endMs)));
    return `<section class="sim-panel sim-effect-lanes"><h4>${escapeHtml(panel.title)}</h4>${panel.lanes
      .map(
        (lane) =>
          `<div class="sim-effect-lane"><span>${escapeHtml(lane.label)}</span><div>${lane.intervals
            .map(
              ({ startMs, endMs }) =>
                `<i style="left:${(startMs / duration) * 100}%;width:${Math.max(0, ((endMs - startMs) / duration) * 100)}%"></i>`
            )
            .join('')}</div></div>`
      )
      .join('')}</section>`;
  }

  if (panel.kind === 'warnings') {
    return `<section class="sim-panel sim-warnings"><h4>${escapeHtml(panel.title)}</h4><ul>${panel.warnings
      .map((warning) => `<li>${escapeHtml(warning)}</li>`)
      .join('')}</ul></section>`;
  }

  return `<section class="sim-panel sim-state-snapshot"><h4>${escapeHtml(panel.title)}</h4><dl>${panel.entries
    .map(({ label, value }) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`)
    .join('')}</dl></section>`;
}

/** Renders stable neutral panels and delegates only explicitly game-owned extension panels. */
export function mountSimulationView(container: HTMLElement | null | undefined, view: SimulationViewSection): void {
  if (!container) return;
  const extensions = (view.panels || []).filter(
    (panel): panel is SimulationExtensionViewModel => panel.kind === 'extension'
  );
  if (extensions.length) {
    container.innerHTML = '';
    for (const extension of extensions) extension.mount(container);
    return;
  }

  const metrics = view.metrics || [];
  container.innerHTML = `${
    metrics.length
      ? `<div class="sim-summary res-summary${view.summaryPlaceholder ? ' res-summary-placeholder' : ''}">${metrics
          .map(
            (metric) => `<div class="res-stat"><span class="res-label">${escapeHtml(metric.label)}</span>
              <span class="res-val${metric.className ? ` ${escapeHtml(metric.className)}` : ''}">${escapeHtml(metric.value)}</span></div>`
          )
          .join('')}</div>`
      : ''
  }${(view.panels || [])
    .filter(
      (panel): panel is Exclude<SimulationPanelViewModel, SimulationExtensionViewModel> => panel.kind !== 'extension'
    )
    .map(panelHtml)
    .join('')}`;
}
