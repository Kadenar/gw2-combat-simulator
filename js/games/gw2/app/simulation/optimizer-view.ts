import { renderGearOptimizer } from '#gw2/app/simulation/gear-optimizer/gear-optimizer-panel.js';
import { renderRelicComparison } from '#gw2/app/simulation/relic-comparison/relic-comparison-panel.js';
import type { ProfessionAppState } from '#gw2/app/types.js';

/** Refreshes the optimizer tab's independent tools after shared build state changes. */
export function renderGearOptimizerView(app: ProfessionAppState): void {
  renderGearOptimizer(app);
  renderRelicComparison(app);
}
