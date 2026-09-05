import { enterRotationFocus } from '#app/shell/workspace.js';
import { bindRotationImportDialog } from '#gw2/app/build/io/rotation-import-dialog.js';
import { buildChartSeries, chartValueAt } from '#gw2/app/results/model.js';
import { paletteEndState } from '#gw2/app/rotation/shared/context.js';
import { applyTimelinePreviewHighlight, renderTimeline } from '#gw2/app/rotation/timeline/view.js';
import { normalizeRotationInsertionIndex } from '#ui/rotation/insertion-cursor.js';

import type { ChartSeries } from '#gw2/app/results/charts/time-series-model.js';
import type { ProfessionAppResult, ProfessionAppState } from '#gw2/app/types.js';
import type { Gw2SimulationResult } from '#gw2/platform/simulation/types.js';

export interface RotationComparisonMetrics {
  readonly timeMs: number | null;
  readonly maximumTimeMs: number;
  readonly referenceDps: number;
  readonly currentDps: number;
  readonly dpsDifference: number;
  readonly dpsPercentDifference: number | null;
  readonly referenceDamage: number;
  readonly currentDamage: number;
  readonly damageDifference: number;
  readonly damagePercentDifference: number | null;
}

const seriesByResult = new WeakMap<Gw2SimulationResult, ReturnType<typeof buildChartSeries>>();

function preparedSeries(result: Gw2SimulationResult): ReturnType<typeof buildChartSeries> {
  const cached = seriesByResult.get(result);
  if (cached) return cached;
  const series = buildChartSeries(result);
  seriesByResult.set(result, series);
  return series;
}

function percentDifference(current: number, reference: number): number | null {
  return reference === 0 ? null : ((current - reference) / Math.abs(reference)) * 100;
}

/** Uses the insertion checkpoint's elapsed combat time; an end cursor keeps the final comparison. */
export function rotationComparisonTimeMs(app: ProfessionAppState): number | null {
  const index = normalizeRotationInsertionIndex(app.rotationInsertionIndex, app.build.rotation.length);
  if (index == null || index === app.build.rotation.length || !app.results) return null;
  const state = paletteEndState(app);
  if (!state) return null;
  const startMs = Number(app.results.dpsStartTime ?? app.results.firstHitTime ?? 0) * 1000;
  return Math.max(0, Number(state.time || 0) - startMs);
}

/** Projects final or shared-time cumulative metrics from already prepared 250 ms chart series. */
export function rotationComparisonMetricsFromSeries(
  referenceResult: Gw2SimulationResult,
  currentResult: Gw2SimulationResult,
  referenceSeries: ChartSeries,
  currentSeries: ChartSeries,
  previewTimeMs: number | null
): RotationComparisonMetrics {
  const maximumTimeMs = Math.min(referenceSeries.durationMs, currentSeries.durationMs);
  const timeMs = previewTimeMs == null ? null : Math.max(0, Math.min(maximumTimeMs, Number(previewTimeMs) || 0));
  const referenceDps = timeMs == null ? Number(referenceResult.dps || 0) : chartValueAt(referenceSeries.dps, timeMs);
  const currentDps = timeMs == null ? Number(currentResult.dps || 0) : chartValueAt(currentSeries.dps, timeMs);
  const referenceDamage =
    timeMs == null
      ? Number(referenceResult.totalDamage || 0)
      : chartValueAt(referenceSeries.cumulativeDamage || [], timeMs);
  const currentDamage =
    timeMs == null
      ? Number(currentResult.totalDamage || 0)
      : chartValueAt(currentSeries.cumulativeDamage || [], timeMs);

  return {
    timeMs,
    maximumTimeMs,
    referenceDps,
    currentDps,
    dpsDifference: currentDps - referenceDps,
    dpsPercentDifference: percentDifference(currentDps, referenceDps),
    referenceDamage,
    currentDamage,
    damageDifference: currentDamage - referenceDamage,
    damagePercentDifference: percentDifference(currentDamage, referenceDamage)
  };
}

/** Builds the small comparison projection for callers that do not already own prepared chart series. */
export function rotationComparisonMetrics(
  referenceResult: Gw2SimulationResult,
  currentResult: Gw2SimulationResult,
  previewTimeMs: number | null
): RotationComparisonMetrics {
  return rotationComparisonMetricsFromSeries(
    referenceResult,
    currentResult,
    preparedSeries(referenceResult),
    preparedSeries(currentResult),
    previewTimeMs
  );
}

function currentIsFresh(app: ProfessionAppState): boolean {
  return (
    Boolean(app.results) &&
    app.build.rotation.length > 0 &&
    app.resultRevision === app.buildRevision &&
    app.simulationStatus === 'idle' &&
    !app.simulationError
  );
}

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString();
}

function formatDifference(value: number): string {
  return `${value > 0 ? '+' : ''}${formatNumber(value)}`;
}

function formatPercent(value: number | null): string {
  return value == null || !Number.isFinite(value) ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function comparisonHeadingButtons(app: ProfessionAppState): void {
  const controls = document.querySelector<HTMLElement>('.rotation-builder-controls');
  if (!controls) return;
  let compareButton = controls.querySelector<HTMLButtonElement>('[data-rotation-compare]');
  if (!compareButton) {
    compareButton = document.createElement('button');
    compareButton.type = 'button';
    compareButton.className = 'btn btn-io rotation-compare-button';
    compareButton.dataset.rotationCompare = '';
    compareButton.textContent = 'Compare';
    compareButton.title = 'Open rotation comparison';
    controls.insertBefore(compareButton, controls.querySelector('.simulation-config-open-button'));
  }

  compareButton.hidden = Boolean(app.rotationComparison);
  compareButton.disabled = !currentIsFresh(app);
  compareButton.setAttribute('aria-pressed', String(Boolean(app.rotationComparison)));
  compareButton.onclick = () => app.startRotationComparison();

  let exitButton = controls.querySelector<HTMLButtonElement>('[data-rotation-comparison-exit]');
  if (!app.rotationComparison) {
    exitButton?.remove();
    return;
  }

  if (!exitButton) {
    exitButton = document.createElement('button');
    exitButton.type = 'button';
    exitButton.className = 'btn btn-io rotation-comparison-exit-button';
    exitButton.dataset.rotationComparisonExit = '';
    exitButton.textContent = 'Exit comparison';
    controls.insertBefore(exitButton, controls.querySelector('.rotation-focus-toggle'));
  }

  exitButton.onclick = () => app.exitRotationComparison();
}

function removeComparisonView(): void {
  document.body?.removeAttribute('data-rotation-comparison');
  document.getElementById('rotation-comparison-summary')?.remove();
  document.getElementById('rotation-comparison-current-label')?.remove();
  document.getElementById('rotation-comparison-reference')?.remove();
  document.querySelector('dialog[data-rotation-import-destination="reference"]')?.remove();
}

function createComparisonView(
  app: ProfessionAppState,
  currentTimeline: HTMLElement
): {
  summary: HTMLElement;
  referenceSection: HTMLElement;
  referenceTimeline: HTMLElement;
} {
  const summary = document.createElement('section');
  summary.id = 'rotation-comparison-summary';
  summary.className = 'rotation-comparison-summary';
  summary.setAttribute('aria-label', 'Rotation comparison summary');
  summary.innerHTML = `<div class="rotation-comparison-metrics">
    <div class="rotation-comparison-stat rotation-comparison-reference-stat">
      <span>Reference DPS</span><strong data-comparison-reference-dps>—</strong>
      <small>Damage <span data-comparison-reference-damage>—</span></small>
    </div>
    <div class="rotation-comparison-stat rotation-comparison-current-stat">
      <span>Current DPS</span><strong data-comparison-current-dps>—</strong>
      <small>Damage <span data-comparison-current-damage>—</span></small>
    </div>
    <div class="rotation-comparison-stat rotation-comparison-change-stat">
      <span>Change</span><strong><span data-comparison-dps-change>—</span> <small data-comparison-dps-percent>—</small></strong>
      <small>Damage <span data-comparison-damage-change>—</span> <span data-comparison-damage-percent>—</span></small>
    </div>
  </div>
  <div class="rotation-comparison-time">
    <span data-comparison-metric-label>Final DPS</span>
    <span>Move the insertion cursor to compare</span>
  </div>`;

  const currentLabel = document.createElement('h4');
  currentLabel.id = 'rotation-comparison-current-label';
  currentLabel.className = 'rotation-comparison-timeline-label rotation-comparison-current-label';
  currentLabel.textContent = 'Current — Editing';

  const referenceSection = document.createElement('section');
  referenceSection.id = 'rotation-comparison-reference';
  referenceSection.className = 'rotation-comparison-reference';
  referenceSection.innerHTML = `<header class="rotation-comparison-reference-header">
      <h4 class="rotation-comparison-timeline-label rotation-comparison-reference-label">Reference — Read only</h4>
      <div class="rotation-comparison-reference-actions" data-comparison-reference-actions hidden>
        <span role="status" data-comparison-status></span>
        <button type="button" class="btn btn-io" data-comparison-reference-load>Load rotation</button>
        <button type="button" class="btn btn-io" data-comparison-swap>Swap</button>
        <button type="button" class="btn" data-comparison-reference-clear>Clear</button>
      </div>
    </header>
    <div id="rotation-reference-timeline" class="rotation-timeline rotation-reference-timeline" aria-readonly="true"></div>
    <div class="rotation-comparison-empty" data-comparison-reference-empty>
      <strong>Load a comparison</strong>
      <span>Import a rotation or choose one from the build manifest</span>
      <button type="button" class="btn btn-io" data-comparison-empty-load>Load comparison</button>
    </div>
    <input type="file" data-comparison-reference-file hidden>`;
  const referenceTimeline = referenceSection.querySelector<HTMLElement>('#rotation-reference-timeline');
  const loadButton = referenceSection.querySelector<HTMLElement>('[data-comparison-reference-load]');
  const emptyLoadButton = referenceSection.querySelector<HTMLButtonElement>('[data-comparison-empty-load]');
  const fileInput = referenceSection.querySelector<HTMLInputElement>('[data-comparison-reference-file]');
  if (!referenceTimeline || !loadButton || !emptyLoadButton || !fileInput) {
    throw new Error('Rotation comparison timeline failed to initialize.');
  }

  bindRotationImportDialog(app, loadButton, fileInput, 'reference');
  emptyLoadButton.onclick = () => loadButton.click();

  currentTimeline.before(summary, currentLabel);
  currentTimeline.after(referenceSection);
  return { summary, referenceSection, referenceTimeline };
}

/** Mounts and refreshes the single stacked comparison view around the existing editable timeline. */
export function renderRotationComparison(app: ProfessionAppState): void {
  if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return;
  comparisonHeadingButtons(app);
  const comparison = app.rotationComparison;
  if (!comparison) {
    removeComparisonView();
    return;
  }

  const currentTimeline = document.getElementById('rotation-timeline');
  if (!currentTimeline) return;
  document.body?.setAttribute('data-rotation-comparison', '');
  enterRotationFocus(document);

  let summary = document.getElementById('rotation-comparison-summary');
  let referenceSection = document.getElementById('rotation-comparison-reference');
  let referenceTimeline = document.getElementById('rotation-reference-timeline');
  if (!summary || !referenceSection || !referenceTimeline) {
    removeComparisonView();
    ({ summary, referenceSection, referenceTimeline } = createComparisonView(app, currentTimeline));
    document.body?.setAttribute('data-rotation-comparison', '');
  }

  const currentResult = app.results;
  const referenceResult = comparison.referenceResult;
  const hasReference = comparison.referenceRotation.length > 0;
  const referenceActions = referenceSection.querySelector<HTMLElement>('[data-comparison-reference-actions]');
  const referenceEmpty = referenceSection.querySelector<HTMLElement>('[data-comparison-reference-empty]');
  const status = referenceSection.querySelector<HTMLElement>('[data-comparison-status]');
  const swapButton = referenceSection.querySelector<HTMLButtonElement>('[data-comparison-swap]');
  const clearButton = referenceSection.querySelector<HTMLButtonElement>('[data-comparison-reference-clear]');

  summary.hidden = !referenceResult;
  if (referenceActions) referenceActions.hidden = !hasReference;
  if (referenceEmpty) referenceEmpty.hidden = hasReference;
  referenceTimeline.hidden = !hasReference;
  if (status) {
    status.textContent =
      comparison.referenceStatus === 'error'
        ? 'Reference error'
        : comparison.referenceStatus === 'fresh'
          ? 'Fresh'
          : 'Updating';
  }

  if (swapButton) {
    swapButton.disabled = !currentIsFresh(app) || comparison.referenceStatus !== 'fresh' || !referenceResult;
    swapButton.onclick = () => app.swapRotationComparison();
  }

  if (clearButton) clearButton.onclick = () => app.clearRotationReference();

  const metrics =
    currentResult && referenceResult
      ? rotationComparisonMetrics(referenceResult, currentResult, rotationComparisonTimeMs(app))
      : null;
  renderTimeline(app, {
    root: referenceTimeline,
    procRoot: null,
    build: { ...app.build, rotation: comparison.referenceRotation },
    result: referenceResult as ProfessionAppResult | null,
    readOnly: true,
    previewTimeMs: metrics?.timeMs
  });
  referenceSection.dataset.referenceStatus = comparison.referenceStatus;
  referenceSection.title = comparison.referenceError;
  if (!metrics) {
    applyTimelinePreviewHighlight(currentTimeline, currentResult, null);
    return;
  }

  const fresh = currentIsFresh(app) && comparison.referenceStatus === 'fresh';
  const setText = (selector: string, value: string): void => {
    const element = summary?.querySelector<HTMLElement>(selector);
    if (element) element.textContent = value;
  };

  setText('[data-comparison-reference-dps]', formatNumber(metrics.referenceDps));
  setText('[data-comparison-current-dps]', formatNumber(metrics.currentDps));
  setText('[data-comparison-reference-damage]', formatNumber(metrics.referenceDamage));
  setText('[data-comparison-current-damage]', formatNumber(metrics.currentDamage));
  setText('[data-comparison-dps-change]', fresh ? formatDifference(metrics.dpsDifference) : '—');
  setText('[data-comparison-dps-percent]', fresh ? formatPercent(metrics.dpsPercentDifference) : '—');
  setText('[data-comparison-damage-change]', fresh ? formatDifference(metrics.damageDifference) : '—');
  setText('[data-comparison-damage-percent]', fresh ? formatPercent(metrics.damagePercentDifference) : '—');
  setText(
    '[data-comparison-metric-label]',
    metrics.timeMs == null ? 'Final DPS' : `Average DPS through ${(metrics.timeMs / 1000).toFixed(2)}s`
  );
  if (status) {
    status.textContent =
      comparison.referenceStatus === 'error'
        ? 'Reference error'
        : app.simulationStatus === 'error'
          ? 'Current error'
          : fresh
            ? 'Fresh'
            : 'Updating';
  }

  applyTimelinePreviewHighlight(currentTimeline, currentResult, metrics.timeMs);
}
