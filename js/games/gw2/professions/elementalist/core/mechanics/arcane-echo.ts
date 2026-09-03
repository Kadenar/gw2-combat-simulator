/** Owns Arcane Echo's window and the later weapon cast that consumes it. */
import { balanceProfileValueFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { Skill } from '#gw2/platform/engine/types.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profiles.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistCastContext } from '#gw2/professions/elementalist/types.js';

/** Arms Arcane Echo or consumes its window to reset the next recharging weapon skill. */
export function completeArcaneEcho(context: ElementalistCastContext, skill: Skill): void {
  const state = professionCoreState(context);
  if (Number(skill.id) === ID.ARCANE_ECHO) {
    state.arcaneEchoUntil =
      context.effectiveEnd + balanceProfileValueFromContext(context, PROFILE.arcaneEcho, 'durationMultiplier', 10);
    return;
  }

  if (state.arcaneEchoUntil < context.effectiveEnd || skill.type !== 'Weapon' || Number(skill.cooldown || 0) <= 0)
    return;

  state.arcaneEchoUntil = 0;
  context.state.cooldowns.set(
    skill.id,
    context.effectiveEnd + balanceProfileValueFromContext(context, PROFILE.arcaneEcho, 'recharge', 1)
  );
  const arcaneEcho = context.catalog.skillsById.get(ID.ARCANE_ECHO);
  if (arcaneEcho) {
    const currentReadyAt = Number(context.state.cooldowns.get(arcaneEcho.id) || context.effectiveEnd);
    context.state.cooldowns.set(arcaneEcho.id, currentReadyAt + context.rechargeDuration);
  }
}
