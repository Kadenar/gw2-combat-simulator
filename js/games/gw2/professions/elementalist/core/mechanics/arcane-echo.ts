import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
/** Owns Arcane Echo's window and the later weapon cast that consumes it. */
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profiles.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';

/** Arms Arcane Echo or consumes its window to reset the next recharging weapon skill. */
export function completeArcaneEcho(context: ElementalistRuntime, cast: RuntimeCast, skill: Skill): void {
  const state = professionCoreState(context);
  if (Number(skill.id) === ID.ARCANE_ECHO) {
    const arcaneEchoProfile = requireBalanceProfileFromContext(context, PROFILE.arcaneEcho);
    state.arcaneEchoUntil = cast.effectiveEnd + balanceProfileNumber(arcaneEchoProfile, 'durationMultiplier');
    return;
  }

  // Zero means unarmed; an armed window stops granting resets at its expiry.
  if (
    state.arcaneEchoUntil <= 0 ||
    state.arcaneEchoUntil <= cast.effectiveEnd ||
    skill.type !== 'Weapon' ||
    Number(skill.cooldown || 0) <= 0
  )
    return;

  state.arcaneEchoUntil = 0;
  const arcaneEchoProfile = requireBalanceProfileFromContext(context, PROFILE.arcaneEcho);
  // Capture the weapon skill's committed base-recharge work before replacing its cooldown with the reset delay.
  const addedWork = context.rechargeProgress.get(skill.id)?.work ?? cast.rechargeWork;
  context.cooldownController.setReadyAt(
    skill.id,
    cast.effectiveEnd + balanceProfileNumber(arcaneEchoProfile, 'recharge')
  );
  const arcaneEcho = context.helpers.skillsById.get(ID.ARCANE_ECHO);
  if (arcaneEcho) {
    // At weapon-cast completion, add that work to Arcane Echo's remaining base-recharge work.
    // Project combined work at the permanent recharge rate while preserving progress already earned.
    const currentReadyAt = Number(context.cooldowns.get(arcaneEcho.id) || cast.effectiveEnd);
    const progress = context.rechargeProgress.get(arcaneEcho.id);
    const work = progress
      ? context.cooldownController.remaining(arcaneEcho, progress, cast.effectiveEnd)
      : Math.max(0, currentReadyAt - cast.effectiveEnd) * context.cooldownController.rate(arcaneEcho);
    context.cooldownController.startRecharge(arcaneEcho, cast.effectiveEnd, work + addedWork);
  }
}
