/** Owns Arcane Echo's window and the later weapon cast that consumes it. */
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profiles.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistCastContext } from '#gw2/professions/elementalist/types.js';

/** Arms Arcane Echo or consumes its window to reset the next recharging weapon skill. */
export function completeArcaneEcho(context: ElementalistCastContext, skill: Skill): void {
  const state = professionCoreState(context);
  if (Number(skill.id) === ID.ARCANE_ECHO) {
    const arcaneEchoProfile = requireBalanceProfileFromContext(context, PROFILE.arcaneEcho);
    state.arcaneEchoUntil = context.effectiveEnd + balanceProfileNumber(arcaneEchoProfile, 'durationMultiplier');
    return;
  }

  // Zero means unarmed; an armed window stops granting resets at its expiry.
  if (
    state.arcaneEchoUntil <= 0 ||
    state.arcaneEchoUntil <= context.effectiveEnd ||
    skill.type !== 'Weapon' ||
    Number(skill.cooldown || 0) <= 0
  )
    return;

  state.arcaneEchoUntil = 0;
  const arcaneEchoProfile = requireBalanceProfileFromContext(context, PROFILE.arcaneEcho);
  // Capture the weapon skill's committed base-recharge work before replacing its cooldown with the reset delay.
  const addedWork = context.state.rechargeProgress.get(skill.id)?.work ?? context.rechargeWork;
  context.cooldownController.setReadyAt(
    skill.id,
    context.effectiveEnd + balanceProfileNumber(arcaneEchoProfile, 'recharge')
  );
  const arcaneEcho = context.catalog.skillsById.get(ID.ARCANE_ECHO);
  if (arcaneEcho) {
    // At weapon-cast completion, add that work to Arcane Echo's remaining base-recharge work.
    // Reprojecting the combined work preserves progress already earned and lets later Alacrity changes affect it.
    const currentReadyAt = Number(context.state.cooldowns.get(arcaneEcho.id) || context.effectiveEnd);
    const progress = context.state.rechargeProgress.get(arcaneEcho.id);
    const work = progress
      ? context.cooldownController.remaining(arcaneEcho, progress, context.effectiveEnd)
      : Math.max(0, currentReadyAt - context.effectiveEnd) *
        context.cooldownController.rate(arcaneEcho, context.effectiveEnd);
    context.cooldownController.startRecharge(arcaneEcho, context.effectiveEnd, work + addedWork);
  }
}
