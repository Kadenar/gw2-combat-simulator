import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import type { RevenantEnergyContext, RevenantSkill } from '#gw2/professions/revenant/types.js';

/** Identifies Energy Meld's Angsiyah's Trust interaction so unrelated skills keep their normal costs. */
function energyMeldIsFree(context: RevenantEnergyContext, skill: RevenantSkill): boolean {
  return skill.handlerId === 'revenant.energy-meld' && hasTrait(context.config, TRAIT.ANGSIYANS_TRUST);
}

/** Applies Vindicator's Angsiyah's Trust free-cast rule without exposing it to Revenant Core. */
export function applyVindicatorEnergyCostRules(
  context: RevenantEnergyContext,
  skill: RevenantSkill,
  baseCost: number
): number {
  return energyMeldIsFree(context, skill) ? 0 : baseCost;
}
