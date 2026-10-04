import { energyMeldIsFree } from '#gw2/professions/revenant/specializations/vindicator/traits/energy-meld.js';
import type { RevenantEnergyCostInput, RevenantSkill } from '#gw2/professions/revenant/types.js';

/** Applies Vindicator's Angsiyah's Trust free-cast rule without exposing it to Revenant Core. */
export function applyVindicatorEnergyCostRules(
  input: RevenantEnergyCostInput,
  skill: RevenantSkill,
  baseCost: number
): number {
  return energyMeldIsFree(input, skill) ? 0 : baseCost;
}
