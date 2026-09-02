import { targetHealthBreakpointSnapshots } from '#gw2/app/presentation/results/result-transform.js';
import type { RotationResultsModel, RotationResultsOptions } from '#gw2/app/presentation/results/rotation-results.js';
import { SKILL_COLS } from '#gw2/app/presentation/results/result-columns.js';
import { PLACEHOLDER_ICON, resultSkillIcon } from '#gw2/app/rotation/shared/icons.js';
import { buildChartSeries, resultSummaryMetrics, skillBreakdownRows } from '#gw2/app/rotation/result/model.js';
import { analyzeRotationLoops } from '#gw2/app/rotation/result/loop-analysis.js';
import type { SimulationViewModel } from '#app/shell/types.js';
import type { SimulationViewSection } from '#ui/simulation-view.js';
import type { ResultIconRow } from '#gw2/app/rotation/shared/icons.js';
import type { ProfessionAppResult, ProfessionAppState } from '#gw2/app/types.js';

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

const EMPTY_RESULT_METRICS = Object.freeze([
  { label: 'Duration', value: '—', className: '' },
  { label: 'Total Idle Time', value: '—', className: '' },
  { label: 'Player Damage', value: '—', className: '' },
  { label: 'Player DPS', value: '—', className: 'dps' },
  { label: 'Strike', value: '—', className: '' },
  { label: 'Condition', value: '—', className: 'condi' }
]);

const loadRotationResultsView = () => import('#gw2/app/presentation/results/rotation-results.js');
const loadShellResultView = () => import('#app/shell/result-view.js');

/** Adapts the existing GW2 result surface as one explicit game-owned extension panel. */
function gw2ResultView(model: RotationResultsModel, options?: RotationResultsOptions): SimulationViewSection {
  return {
    panels: [
      {
        kind: 'extension',
        mount(container) {
          void loadRotationResultsView().then(({ mountRotationResults }) =>
            mountRotationResults(container, model, options)
          );
        }
      }
    ]
  };
}

/** Keeps the optional patch preview in its own stable root beside the main analysis results. */
function renderPatchPreview(app: ProfessionAppState): void {
  const container = document.getElementById('patch-comparison-results');
  if (container) void app.adapter?.capabilities?.patchPreview?.render(container, app);
}

/** Projects RNG state independently so the workspace can render it without analysis tables. */
function randomDistributionModel(result: ProfessionAppResult) {
  return {
    randomDistribution: result.randomDistribution || null,
    randomDistributionRequested: result.randomDistributionRequested === true,
    randomDistributionStale: result.randomDistributionStale === true,
    randomDistributionTrials: Number(result.randomDistributionTrials || 0),
    randomDistributionProgress: result.randomDistributionProgress || null,
    randomDistributionError: result.randomDistributionError || ''
  };
}

/** Converts a GW2 resolver result into the neutral result-view contract. */
export function createGw2SimulationViewModel(app: ProfessionAppState): SimulationViewModel {
  const result = app.results;
  if (!app.build.rotation.length || !result) {
    return {
      summary: gw2ResultView({ metrics: EMPTY_RESULT_METRICS, summaryPlaceholder: true }),
      workspace: null,
      analysis: null,
      floatingDps: null,
      analysisEmpty: {
        title: 'No analysis yet',
        message: 'Add skills to the rotation in the ',
        link: { href: '#workspace', label: 'Workspace' }
      },
      afterAnalysisRender: () => renderPatchPreview(app)
    };
  }

  const metrics = resultSummaryMetrics(result).map((metric) =>
    result.randomDistributionRequested && metric.label === 'Player DPS'
      ? { ...metric, label: 'Baseline Player DPS' }
      : metric
  );
  const skillRows = skillBreakdownRows(result);
  const conditions = result.conditionBreakdown || [];
  const contributions = (result.contributions || []).map((contribution) => ({
    ...contribution,
    icon: resultSkillIcon(app, contribution)
  }));
  const breakpoints = targetHealthBreakpointSnapshots(
    result,
    app.build.targetHealth,
    undefined,
    app.build.targetStartingHealthPercent
  );
  app._skillBreakdownState = { skillRows };

  return {
    summary: gw2ResultView({ metrics, breakpoints }),
    floatingDps: metrics.find((metric) => metric.className === 'dps')?.value,
    workspace: gw2ResultView(
      {
        showSummary: false,
        ...randomDistributionModel(result)
      },
      {
        onRunRandomDistribution: () => app.runRandomDistribution()
      }
    ),
    analysis: gw2ResultView(
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
        contributionsError: result.modifierContributionsError || '',
        ...randomDistributionModel(result),
        chartSeries: buildChartSeries(result),
        relicComparison: result.relicComparison || null,
        relicComparisonAvailable: result.relicComparisonAvailable === true,
        relicComparisonStale: result.relicComparisonStale === true,
        relicComparisonError: result.relicComparisonError || '',
        relicComparisonOpponent: result.relicComparisonOpponent || ''
      },
      {
        resolveSkillIcon: (row) => resultSkillIcon(app, row as ResultIconRow),
        placeholderIcon: PLACEHOLDER_ICON,
        skillBreakdownClassName: `${app.adapter?.id || 'simulation'}-skill-breakdown`,
        chartOptions: {
          title: 'DPS & Effects Over Time',
          dpsLabel: 'Average DPS',
          dpsColor: '#54c96b',
          colors: EFFECT_COLORS,
          defaultVisibleEffectLimit: 8,
          emptyEffectsText: 'No timed effects in this rotation'
        },
        resultRevision: app.resultRevision,
        sortState: {
          column: app._skillSortCol,
          direction: app._skillSortDir
        },
        onSortStateChange(nextState) {
          app._skillSortCol = nextState.column;
          app._skillSortDir = nextState.direction;
        },
        onRunRandomDistribution: () => app.runRandomDistribution(),
        loadLoopAnalysis: () => analyzeRotationLoops(app),
        loopApp: app,
        ...(app.adapter?.capabilities?.relicComparison
          ? { onRunRelicComparison: () => app.runRelicComparison() }
          : null)
      }
    ),
    afterAnalysisRender: () => renderPatchPreview(app)
  };
}

/** Owns the only GW2 result-rendering path: callers create a view model, then render it through this contract. */
export const gw2SimulationPresentation = Object.freeze({
  createViewModel: createGw2SimulationViewModel,
  render(app: ProfessionAppState, viewModel: SimulationViewModel) {
    void loadShellResultView().then(({ renderSimulationViewModel }) =>
      renderSimulationViewModel(viewModel, {
        inputRevision: app.buildRevision,
        outputRevision: app.resultRevision
      })
    );
  }
});
