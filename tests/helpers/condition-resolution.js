/** Supplies a real condition module for runtime fixtures that do not need condition reactions. */
import { createEffectExpansionBudget } from '#gw2/platform/effects/expansion-budget.js';
import { createGw2ConditionResolution } from '#gw2/platform/resolver/condition-resolution.js';

export function createTestConditionResolution(config = {}) {
  return createGw2ConditionResolution({
    config,
    expansionBudget: createEffectExpansionBudget(),
    reactions: { dispatch() {} }
  });
}
