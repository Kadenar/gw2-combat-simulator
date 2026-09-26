import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/core/profiles.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type { RangerRuntime, RangerSkill } from '#gw2/professions/ranger/types.js';

/** Select recharge from current traits and the unclaimed Quick Draw grant. */
export function rangerRechargeWork(context: RangerRuntime, skill: RangerSkill, duration: number): number {
  let result = duration;
  const state = professionCoreState(context);
  if (
    skill?.type === 'Weapon' &&
    skill.slot !== 'Weapon_1' &&
    state.quickDrawUntil > context.time &&
    hasTrait(context, TRAIT.QUICK_DRAW)
  ) {
    result *= balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.quickDraw), 'rechargeMultiplier');
  }

  if (skill?.weapon === 'Axe' && hasTrait(context, TRAIT.HONED_AXES)) {
    result *= balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.honedAxes), 'rechargeMultiplier');
  }

  if (skill?.weapon === 'Shortbow' && hasTrait(context, TRAIT.LIGHT_ON_YOUR_FEET)) {
    result *= balanceProfileNumber(
      requireBalanceProfileFromContext(context, PROFILE.lightOnYourFeet),
      'rechargeMultiplier'
    );
  }

  // Lead the Wind reduces every supported longbow skill's base recharge before shared recharge-rate scaling.
  if (skill?.weapon === 'Longbow' && hasTrait(context, TRAIT.LEAD_THE_WIND)) {
    result *= balanceProfileNumber(
      requireBalanceProfileFromContext(context, PROFILE.leadTheWind),
      'rechargeMultiplier'
    );
  }

  if (['Dagger', 'Torch'].includes(String(skill?.weapon || '')) && hasTrait(context, TRAIT.AMBIDEXTERITY)) {
    result *= balanceProfileNumber(
      requireBalanceProfileFromContext(context, PROFILE.ambidexterity),
      'rechargeMultiplier'
    );
  }

  if (skill?.petSkill && hasTrait(context, TRAIT.PACK_ALPHA)) {
    result *= balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.packAlpha), 'rechargeMultiplier');
  }

  return result;
}
