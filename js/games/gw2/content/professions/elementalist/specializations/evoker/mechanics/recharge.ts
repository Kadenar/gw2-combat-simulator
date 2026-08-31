import { balanceProfileValueFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { Skill } from '#gw2/platform/engine/types.js';
import type { ElementalistSchedulerContext } from '#gw2/content/professions/elementalist/types.js';

import { evokerState } from '#gw2/content/professions/elementalist/specializations/evoker/state.js';
import { EVOKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/elementalist/specializations/evoker/profiles.js';

/**
 * Spends an armed Elemental Balance window on the next non-autoattack weapon
 * skill, scaling its recharge by the profile multiplier. The window is
 * single-use and is cleared here as soon as one skill consumes it.
 */
export function modifyRechargeDuration(
  context: ElementalistSchedulerContext & { skill?: Skill },
  duration: number
): number {
  const skill = context.skill;
  // Weapon_1 excluded — auto-attacks don't benefit from Elemental Balance CDR
  if (
    !skill ||
    skill.type !== 'Weapon' ||
    String(skill.slot) === 'Weapon_1' ||
    !hasTrait(context, 'Elemental Balance')
  ) {
    return duration;
  }

  const state = evokerState.from(context);
  if (state.elementalBalanceUntil <= context.state.time + context.epsilon) {
    return duration;
  }

  state.elementalBalanceUntil = 0; // single-use window; next arm cycle starts fresh
  return duration * balanceProfileValueFromContext(context, PROFILE.elementalBalance, 'rechargeMultiplier', 0.34);
}
