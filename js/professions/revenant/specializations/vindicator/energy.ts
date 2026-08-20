import { hasRevenantTrait } from '../../core/state.js';
import type { RevenantEnergyContext, RevenantSkill } from '../../types.js';

/** Applies Vindicator's Angsiyah's Trust free-cast rule without exposing it to Revenant Core. */
export function effectiveVindicatorEnergyCost(
  context: RevenantEnergyContext,
  skill: RevenantSkill,
  baseCost: number
): number {
  return skill.freeWithTraitId != null && hasRevenantTrait(context.config, skill.freeWithTraitId) ? 0 : baseCost;
}
