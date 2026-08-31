import { balanceProfileFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { gainThiefEndurance } from '#gw2/content/professions/thief/core/mechanics/resource-events.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/content/professions/thief/data/ids.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/thief/core/profiles.js';
import type { ThiefCastContext } from '#gw2/content/professions/thief/types.js';

/** Applies movement-skill Acrobatics state before its ordered endurance reaction. */
export function applyFluidStrikes(context: ThiefCastContext, at: number): boolean {
  if (!hasTrait(context.config, TRAIT.FLUID_STRIKES)) return false;
  professionCoreState(context).fluidStrikesUntil =
    at + Number(balanceProfileFromContext(context, PROFILE.fluidStrikes)?.durationMultiplier || 5);
  return true;
}

export function applyHardToCatch(context: ThiefCastContext, at: number): boolean {
  if (!hasTrait(context.config, TRAIT.HARD_TO_CATCH)) return false;
  gainThiefEndurance(
    context,
    Number(balanceProfileFromContext(context, PROFILE.hardToCatch)?.resourceGain || 8),
    at,
    'hard-to-catch'
  );
  return true;
}
