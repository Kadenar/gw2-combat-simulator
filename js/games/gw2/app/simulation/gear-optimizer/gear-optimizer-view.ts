import { renderGearOptimizer } from '#gw2/app/simulation/gear-optimizer/gear-optimizer-panel.js';
import { mountRotationResults } from '#gw2/app/results/rotation-results.js';
import type { ProfessionAppState } from '#gw2/app/types.js';

/** Renders both optimizer tools, comparing relics against the equipped workspace build. */
export function renderGearOptimizerView(app: ProfessionAppState): void {
  renderGearOptimizer(app);
  const container = document.getElementById('optimizer-relic-comparison');
  if (!container || document.body?.dataset.simulatorView !== 'gear-optimizer') return;
  const result = app.results;
  if (!app.build.rotation.length || !result?.relicComparisonAvailable) {
    container.innerHTML =
      '<p class="optimizer-empty">Add a rotation and equip a relic in the <a href="#workspace">Workspace</a> to run a relic comparison.</p>';
    return;
  }

  mountRotationResults(
    container,
    {
      showSummary: false,
      relicComparison: result.relicComparison || null,
      relicComparisonAvailable: result.relicComparisonAvailable === true,
      relicComparisonStale: result.relicComparisonStale === true,
      relicComparisonError: result.relicComparisonError || '',
      relicComparisonOpponent: result.relicComparisonOpponent || '',
      relicComparisonTarget: result.relicComparisonTarget || '',
      relicComparisonTargets: (app.relicNames || []).filter((name) => name !== result.relicComparisonOpponent),
      relicComparisonInitialStacks: result.relicComparisonInitialStacks || 0
    },
    {
      onRunRelicComparison: (relic, stacks) => app.runRelicComparison(relic, stacks)
    }
  );
  // A queued baseline must finish before its output can be used as the comparison opponent.
  const button = container.querySelector<HTMLButtonElement>('[data-role="relic-comparison-run"]');
  if (button && (app.simulationStatus !== 'idle' || app.resultRevision !== app.buildRevision)) button.disabled = true;
}
