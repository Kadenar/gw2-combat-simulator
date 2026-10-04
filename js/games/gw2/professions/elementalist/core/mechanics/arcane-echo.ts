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
import type { ElementalistSkill, ElementalistRuntime } from '#gw2/professions/elementalist/types.js';

/** The skill's commit declaration opens the profiled window for the next recharging weapon cast. */
export function armArcaneEcho(context: ElementalistRuntime, cast: RuntimeCast<ElementalistSkill>): void {
  const arcaneEchoProfile = requireBalanceProfileFromContext(context, PROFILE.arcaneEcho);
  professionCoreState(context).arcaneEchoUntil =
    cast.effectiveEnd + balanceProfileNumber(arcaneEchoProfile, 'durationMultiplier');
}

/** Observes weapon completions to consume an armed window and transfer their recharge work. */
export function completeArcaneEcho(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill
): void {
  const state = professionCoreState(context);

  // Zero means unarmed; an armed window stops granting resets at its expiry.
  if (
    state.arcaneEchoUntil <= 0 ||
    state.arcaneEchoUntil <= cast.effectiveEnd ||
    skill.type !== 'Weapon' ||
    (skill.cooldown || 0) <= 0
  )
    return;

  state.arcaneEchoUntil = 0;
  const arcaneEchoProfile = requireBalanceProfileFromContext(context, PROFILE.arcaneEcho);
  // Capture the weapon skill's committed base-recharge work before replacing its cooldown with the reset delay.
  const addedWork = context.cooldownController.rechargeFor(skill.id)?.work ?? cast.rechargeWork;
  context.cooldownController.setReadyAt(
    skill.id,
    cast.effectiveEnd + balanceProfileNumber(arcaneEchoProfile, 'recharge')
  );
  const arcaneEcho = context.helpers.skillsById.get(ID.ARCANE_ECHO);
  if (arcaneEcho) {
    // At weapon-cast completion, add that work to Arcane Echo's remaining base-recharge work.
    // Project combined work at the permanent recharge rate while preserving progress already earned.
    const currentReadyAt = context.cooldownController.readyAt(arcaneEcho.id) || cast.effectiveEnd;
    const progress = context.cooldownController.rechargeFor(arcaneEcho.id);
    const work = progress
      ? context.cooldownController.remaining(arcaneEcho, progress, cast.effectiveEnd)
      : Math.max(0, currentReadyAt - cast.effectiveEnd) * context.cooldownController.rate(arcaneEcho);
    context.cooldownController.startRecharge(arcaneEcho, cast.effectiveEnd, work + addedWork);
  }
}
