import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { isEngineerToolbeltSkill } from '#gw2/professions/engineer/core/traits/tools.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import type { EngineerRuntime, EngineerSkill } from '#gw2/professions/engineer/types.js';

/** Applies toolbelt and gadget recharge reductions from the active Core traits. */
export function engineerRechargeWork(context: EngineerRuntime, skill: EngineerSkill, duration: number): number {
  if (isEngineerToolbeltSkill(skill) && hasTrait(context.config, TRAIT.MECHANIZED_DEPLOYMENT)) {
    const mechanizedDeploymentProfile = requireBalanceProfileFromContext(context, TRAIT.MECHANIZED_DEPLOYMENT);
    return duration * balanceProfileNumber(mechanizedDeploymentProfile, 'rechargeMultiplier');
  }

  if (
    skill?.categories?.some((category) => String(category).toLowerCase() === 'gadget') &&
    hasTrait(context.config, TRAIT.GADGETEER)
  ) {
    const gadgeteerProfile = requireBalanceProfileFromContext(context, TRAIT.GADGETEER);
    return duration * balanceProfileNumber(gadgeteerProfile, 'rechargeMultiplier');
  }

  return duration;
}
