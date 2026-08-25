import { hasTrait as hasGw2Trait } from '../../../../platform/gw2/combat/state/traits.js';
import type { Skill } from '../../../../platform/engine/types.js';
import type { ElementalistSchedulerContext } from '../../types.js';
import { elementalistBalanceValue } from '../../core/profiles.js';
import { evokerState } from './state.js';
import { EVOKER_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';

function hasTrait(context: unknown, trait: string): boolean {
  return hasGw2Trait(context as never, trait);
}

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
  return duration * elementalistBalanceValue(context, PROFILE.elementalBalance, 'rechargeMultiplier', 0.34);
}
