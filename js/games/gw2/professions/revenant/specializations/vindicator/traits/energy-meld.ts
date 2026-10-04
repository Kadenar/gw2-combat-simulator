import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import type { RevenantEnergyCostInput, RevenantSkill } from '#gw2/professions/revenant/types.js';

/** Cost queries need only selected traits; Energy Meld's resource grant remains with active trait behavior. */
export function energyMeldIsFree(input: RevenantEnergyCostInput, skill: RevenantSkill): boolean {
  return (
    (skill.id === ID.ENERGY_MELD || skill.id === ID.ENERGY_MELD_ID_72058) &&
    hasTrait(input.traits, TRAIT.ANGSIYANS_TRUST)
  );
}
