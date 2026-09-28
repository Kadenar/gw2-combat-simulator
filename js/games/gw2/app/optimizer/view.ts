import { renderGearOptimizer } from '#gw2/app/optimizer/gear/panel.js';
import { renderRelicComparison } from '#gw2/app/optimizer/relic-comparison/panel.js';
import type { ProfessionAppState } from '#gw2/app/types.js';

/** Refreshes the optimizer tab's independent tools after shared build state changes. */
export function renderGearOptimizerView(app: ProfessionAppState): void {
  renderGearOptimizer(app);
  renderRelicComparison(app);
}
