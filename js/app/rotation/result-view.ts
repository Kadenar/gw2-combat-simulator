import { mountRotationResults, SKILL_COLS } from '../../platform/ui/rotation-results.js';
import { syncRotationFocusResults } from '../../platform/ui/rotation-workspace.js';
import { targetHealthBreakpointSnapshots } from '../../platform/ui/result-transform.js';
import type { ProfessionAppState } from '../profession/types.js';
import { PLACEHOLDER_ICON, resultSkillIcon } from './icons.js';
import { renderPatchComparison } from '../simulation/patch-preview-view.js';
import type { ResultIconRow } from './icons.js';
import { buildChartSeries, resultSummaryMetrics, skillBreakdownRows } from './result-model.js';

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
  { label: 'Total Damage', value: '—', className: '' },
  { label: 'DPS', value: '—', className: 'dps' },
  { label: 'Strike', value: '—', className: '' },
  { label: 'Condition', value: '—', className: 'condi' }
]);

export function renderResults(app: ProfessionAppState): void {
  const element = document.getElementById('rotation-results');
  const summaryStrip = document.getElementById('rotation-dps-summary');
  if (!element) return;
  const result = app.results;
  if (!app.build.rotation.length || !result) {
    mountRotationResults(summaryStrip, {
      metrics: EMPTY_RESULT_METRICS,
      summaryPlaceholder: true
    });
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
  // The builder owns the live strip; the results root only renders detailed analysis.
  mountRotationResults(summaryStrip, { metrics });
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
      randomDistribution: result.randomDistribution || null,
      randomDistributionRequested: result.randomDistributionRequested === true,
      randomDistributionStale: result.randomDistributionStale === true,
      randomDistributionTrials: Number(result.randomDistributionTrials || 0),
      randomDistributionProgress: result.randomDistributionProgress || null,
      randomDistributionError: result.randomDistributionError || '',
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
