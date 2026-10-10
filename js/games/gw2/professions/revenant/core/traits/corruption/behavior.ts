import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { isDamagingCondition } from '#gw2/platform/combat/state/targets.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';

/** Adds the trait duration only when static build rules have not supplied it. */
export function pactOfPainDuration(context: Gw2ModifierContext, duration: number): number {
  let modified = duration;
  if (hasTrait(context, TRAIT.PACT_OF_PAIN) && !professionStaticRulesApplied(context.config)) {
    const pactOfPainProfile = requireBalanceProfileFromContext(context, TRAIT.PACT_OF_PAIN);
    modified += balanceProfileNumber(pactOfPainProfile, 'conditionDurationBonus');
  }

  return modified;
}

/** Adds the trait duration only when static build rules have not supplied it. */
export function yearningEmpowermentDuration(context: Gw2ModifierContext, duration: number): number {
  let modified = duration;
  if (
    isDamagingCondition(context.condition) &&
    hasTrait(context, TRAIT.YEARNING_EMPOWERMENT) &&
    !professionStaticRulesApplied(context.config)
  ) {
    const yearningEmpowermentProfile = requireBalanceProfileFromContext(context, TRAIT.YEARNING_EMPOWERMENT);
    modified += balanceProfileNumber(yearningEmpowermentProfile, 'conditionDurationBonus');
  }

  return modified;
}
