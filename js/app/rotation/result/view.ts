import { mountRotationResults, SKILL_COLS } from '../../../platform/ui/rotation-results.js';
import { syncRotationFocusResults, updateFloatingDps } from '../workspace.js';
import { targetHealthBreakpointSnapshots } from '../../../platform/ui/result-transform.js';
import type { ProfessionAppResult, ProfessionAppState } from '../../profession/types.js';
import { PLACEHOLDER_ICON, resultSkillIcon } from '../shared/icons.js';
import { renderPatchComparison } from '../../simulation/patch-preview-view.js';
import type { ResultIconRow } from '../shared/icons.js';
import { buildChartSeries, resultSummaryMetrics, skillBreakdownRows } from './model.js';
import { analyzeRotationLoops } from './loop-analysis.js';
import { removeRotationLoopAnalysis, renderRotationLoopAnalysis } from './loop-analysis-view.js';

const EFFECT_COLORS: Readonly<Record<string, string>> = {
  Bleeding: '#d84b4b',
  Burning: '#f28b3c',
  Confusion: '#b874e8',
  Poisoned: '#62b565',
  Torment: '#a96bd3',
  'Compounding Power': '#cfb5ff',
  'Phantom Pain': '#df79bd',
  'Illusionary Membrane': '#6ec9d8',
  'Deadly Blades': '#e38a8a',
  'Altered Chord': '#80bce8',
  "Fencer's Finesse": '#e1c070',
  'Mirage Cloak': '#d6b46b',
  Alacrity: '#9069d8',
  Protection: '#4f9ec2',
  Resolution: '#d48f45',
  Vigor: '#78bd45',
  Might: '#d9a441',
  Fury: '#d65e5e',
  Regeneration: '#5ebc72',
  Swiftness: '#62a7cb',
  Aegis: '#d9b85f'
};

/** Keeps the builder's metric footprint stable before a rotation can be simulated. */
const EMPTY_RESULT_METRICS = Object.freeze([
  { label: 'Duration', value: '—', className: '' },
  { label: 'Total Idle Time', value: '—', className: '' },
  { label: 'Total Damage', value: '—', className: '' },
  { label: 'DPS', value: '—', className: 'dps' },
  { label: 'Strike', value: '—', className: '' },
  { label: 'Condition', value: '—', className: 'condi' }
]);

// Before navigation mounts, the URL hash still identifies whether detailed Analysis is visible.
function analysisViewIsActive(): boolean {
  const body = document.body;
  if (!body) return true;
  const mountedView = body.dataset.simulatorView;
  if (mountedView) return mountedView === 'analysis';
  return document.defaultView?.location.hash === '#analysis';
}

/** Projects RNG state independently so Workspace can render it without materializing Analysis tables and charts. */
function randomDistributionResultModel(result: ProfessionAppResult) {
  return {
    randomDistribution: result.randomDistribution || null,
    randomDistributionRequested: result.randomDistributionRequested === true,
    randomDistributionStale: result.randomDistributionStale === true,
    randomDistributionTrials: Number(result.randomDistributionTrials || 0),
    randomDistributionProgress: result.randomDistributionProgress || null,
    randomDistributionError: result.randomDistributionError || ''
  };
}

/** Updates the small always-visible metrics without building the detailed Analysis DOM. */
export function renderResultSummary(app: ProfessionAppState): void {
  const summaryStrip = document.getElementById('rotation-dps-summary');
  const stale = app.resultRevision !== app.buildRevision;
  if (summaryStrip?.dataset) {
    summaryStrip.dataset.buildRevision = String(app.buildRevision);
    summaryStrip.dataset.resultRevision = String(app.resultRevision);
    summaryStrip.toggleAttribute?.('aria-busy', stale);
  }

  const result = app.results;
  if (!app.build.rotation.length || !result) {
    updateFloatingDps(null);
    mountRotationResults(summaryStrip, {
      metrics: EMPTY_RESULT_METRICS,
      summaryPlaceholder: true
    });
    return;
  }

  const metrics = resultSummaryMetrics(result).map((metric) =>
    result.randomDistributionRequested && metric.label === 'DPS' ? { ...metric, label: 'Baseline DPS' } : metric
  );
  updateFloatingDps(metrics.find((metric) => metric.className === 'dps')?.value);
  mountRotationResults(summaryStrip, { metrics });
}

/** Keeps Workspace-only snapshots and RNG controls interactive while detailed Analysis remains lazy. */
export function renderWorkspaceResults(app: ProfessionAppState): void {
  const element = document.getElementById('rotation-results');
  if (!element) return;
  if (element.dataset) element.dataset.analysisStale = 'true';
  const result = app.results;
  if (!app.build.rotation.length || !result) {
    element.innerHTML = '';
    return;
  }

  mountRotationResults(
    element,
    {
      showSummary: false,
      breakpoints: targetHealthBreakpointSnapshots(result, app.build.targetHealth),
      ...randomDistributionResultModel(result)
    },
    {
      onRunRandomDistribution() {
        app.runRandomDistribution();
      }
    }
  );
}

/** Builds charts, tables, and loop analysis only when the Analysis view is visible. */
export function renderDetailedResults(app: ProfessionAppState): void {
  const element = document.getElementById('rotation-results');
  const summaryStrip = document.getElementById('rotation-dps-summary');
  if (!element) return;
  const result = app.results;
  if (!app.build.rotation.length || !result) {
    removeRotationLoopAnalysis(element);
    element.innerHTML = `<div class="analysis-empty-state">
      <strong>No analysis yet</strong>
      <span>Add skills to the rotation in the <a href="#workspace">Workspace</a> to generate results.</span>
    </div>`;
    const mirror = document.getElementById('analysis-dps-summary');
    if (mirror) mirror.innerHTML = '';
    return;
  }

  const metrics = resultSummaryMetrics(result).map((metric) =>
    result.randomDistributionRequested && metric.label === 'DPS' ? { ...metric, label: 'Baseline DPS' } : metric
  );
  const skillRows = skillBreakdownRows(result);
  const conditions = result.conditionBreakdown || [];
  const series = buildChartSeries(result);
  const contributions = (result.contributions || []).map((contribution) => ({
    ...contribution,
    icon: resultSkillIcon(app, contribution)
  }));
  const breakpoints = targetHealthBreakpointSnapshots(result, app.build.targetHealth);
  app._skillBreakdownState = { skillRows };
  mountRotationResults(
    element,
    {
      metrics,
      showSummary: false,
      breakpoints,
      skillRows,
      skillColumns: SKILL_COLS,
      conditions,
      conditionTotal: conditions.length
        ? {
            label: 'Total Conditions',
            damage: result.conditionDamage,
            dps: result.conditionDamage / Math.max(0.001, Number(result.dpsWindow ?? result.duration ?? 0))
          }
        : null,
      contributions,
      contributionsStale: result.modifierContributionsStale === true,
      ...randomDistributionResultModel(result),
      chartSeries: series,
      relicComparison: result.relicComparison || null,
      relicComparisonAvailable: result.relicComparisonAvailable === true,
      relicComparisonStale: result.relicComparisonStale === true,
      relicComparisonError: result.relicComparisonError || '',
      relicComparisonOpponent: result.relicComparisonOpponent || ''
    },
    {
      resolveSkillIcon: (row) => resultSkillIcon(app, row as ResultIconRow),
      placeholderIcon: PLACEHOLDER_ICON,
      skillBreakdownClassName: `${app.adapter.id}-skill-breakdown`,
      chartOptions: {
        title: 'DPS & Effects Over Time',
        dpsLabel: 'Average DPS',
        dpsColor: '#54c96b',
        colors: EFFECT_COLORS,
        defaultVisibleEffectLimit: 8,
        emptyEffectsText: 'No timed effects in this rotation'
      },
      sortState: {
        column: app._skillSortCol,
        direction: app._skillSortDir
      },
      onSortStateChange(nextState) {
        app._skillSortCol = nextState.column;
        app._skillSortDir = nextState.direction;
      },
      onRunRandomDistribution() {
        app.runRandomDistribution();
      },
      onRunRelicComparison() {
        app.runRelicComparison();
      }
    }
  );
  renderRotationLoopAnalysis(element, app, analyzeRotationLoops(app));
  const mirror = document.getElementById('analysis-dps-summary');
  if (mirror) {
    mirror.innerHTML = '';
    const summary = summaryStrip?.querySelector('.res-summary');
    const bpDetails = element.querySelector('.res-breakpoints');
    if (summary) mirror.appendChild(summary.cloneNode(true));
    if (bpDetails) mirror.appendChild(bpDetails.cloneNode(true));
  }

  renderPatchComparison(element, app);
  syncRotationFocusResults(document);
}

/** Keeps Workspace edits cheap and materializes stale detailed output on demand. */
export function renderResults(app: ProfessionAppState): void {
  renderResultSummary(app);
  const element = document.getElementById('rotation-results');
  if (!element) return;
  if (!analysisViewIsActive()) {
    renderWorkspaceResults(app);
    return;
  }

  if (element.dataset) delete element.dataset.analysisStale;
  renderDetailedResults(app);
}
