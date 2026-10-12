import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import type { RevenantEnergyCostInput, RevenantSkill } from '#gw2/professions/revenant/types.js';

/** Applies Vindicator's Angsiyah's Trust free-cast rule without exposing it to Revenant Core. */
export function applyVindicatorEnergyCostRules(
  input: RevenantEnergyCostInput,
  skill: RevenantSkill,
  baseCost: number
): number {
  return energyMeldIsFree(input, skill) ? 0 : baseCost;
}

/** Cost queries need only selected traits; Energy Meld's resource grant remains with active trait behavior. */
function energyMeldIsFree(input: RevenantEnergyCostInput, skill: RevenantSkill): boolean {
  return (
    (skill.id === ID.ENERGY_MELD || skill.id === ID.ENERGY_MELD_ID_72058) &&
    hasTrait(input.traits, TRAIT.ANGSIYANS_TRUST)
  );
}
