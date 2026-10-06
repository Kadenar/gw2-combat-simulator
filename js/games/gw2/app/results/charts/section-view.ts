import { escapeHtml } from '#ui/shared/html.js';
import { mountTimeSeriesCharts, type ChartOptions } from '#gw2/app/results/charts/time-series-view.js';
import type { ChartSeries } from '#gw2/app/results/charts/time-series-model.js';

export interface ResultChartsModel {
  readonly chartSeries: ChartSeries | null;
  readonly chartsPending?: boolean;
  readonly chartsError?: string;
}

/** Reserve the chart panels while data loads, with decorative motion and a single accessible status. */
function chartLoadingHtml(): string {
  return `<div class="chart-wrap chart-loading" data-role="chart-status" role="status" aria-label="Preparing charts" aria-busy="true">
    <div class="chart-loading-header">
      <div class="chart-title">DPS &amp; Effects Over Time</div>
      <span class="chart-loading-status"><span class="chart-loading-spinner" aria-hidden="true"></span>Preparing charts</span>
    </div>
    <p class="chart-loading-description">Loading damage, effects, and boon timelines…</p>
    <div class="chart-panels" aria-hidden="true">
      <div class="chart-panel">
        <div class="chart-panel-title">Average DPS Over Time</div>
        <div class="chart-loading-plot"></div>
      </div>
      <div class="chart-panel">
        <div class="chart-panel-title">Effects Over Time</div>
        <div class="chart-loading-legend"><span></span><span></span><span></span></div>
        <div class="chart-loading-plot chart-loading-effects"></div>
      </div>
    </div>
  </div>`;
}

/** Appends chart status or mounts prepared series; the caller supplies the shared health-breakpoint options. */
export function mountResultCharts(
  container: HTMLElement,
  model: ResultChartsModel,
  options: Partial<ChartOptions> = {}
): void {
  const { chartSeries } = model;
  container.insertAdjacentHTML(
    'beforeend',
    chartSeries
      ? '<div data-role="result-charts"></div>'
      : model.chartsError
        ? `<div data-role="chart-status" role="alert">Unable to load charts: ${escapeHtml(model.chartsError)}</div>`
        : model.chartsPending
          ? chartLoadingHtml()
          : ''
  );
  const chartContainer = container.querySelector<HTMLElement>('[data-role="result-charts"]');
  if (chartContainer && chartSeries) mountTimeSeriesCharts(chartContainer, chartSeries, options);
}
