import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
/** Owns Arcane Echo's window and the later weapon cast that consumes it. */
import { requireSkillFromContext, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistSkill, ElementalistRuntime } from '#gw2/professions/elementalist/types.js';
import { gw2BaseRecharge } from '#gw2/platform/combat/recharge.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** Fixed replacement work is shared by runtime and tooltip; the skill owns only the echo window. */
export const ARCANE_ECHO_REPLACEMENT_RECHARGE_SECONDS = 1;

/** The skill's commit declaration opens the skill-owned window for the next recharging weapon cast. */
export function armArcaneEcho(context: ElementalistRuntime, cast: RuntimeCast<ElementalistSkill>): void {
  professionCoreState(context).arcaneEchoUntil = canonicalTime(cast.effectiveEnd + skillNumber(cast.skill, 'duration'));
}

/** Observes weapon completions to consume an armed window and transfer their recharge work. */
export function completeArcaneEcho(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill
): void {
  const state = professionCoreState(context);

  // Successful non-autoattack weapon casts claim the window by their start, even if completion is later.
  if (
    cast.cancelled ||
    state.arcaneEchoUntil <= 0 ||
    cast.start > state.arcaneEchoUntil ||
    skill.type !== 'Weapon' ||
    skill.autoattack ||
    skill.slot === 'Weapon_1' ||
    skill.flipParentId ||
    gw2BaseRecharge(skill) <= 0
  )
    return;

  state.arcaneEchoUntil = 0;
  const at = canonicalTime(context.time);
  // Use original recharge before trait reductions; the short replacement still benefits from Alacrity.
  const addedWork = gw2BaseRecharge(skill);
  // Like Mimic, replace the weapon skill's recharge with one base second without replenishing spent ammunition.
  context.cooldownController.replaceSkillRecharge(skill, ARCANE_ECHO_REPLACEMENT_RECHARGE_SECONDS, at);
  const arcaneEcho = requireSkillFromContext(context, ID.ARCANE_ECHO);
  // At weapon-cast completion, add that work to Arcane Echo's remaining base-recharge work.
  // Project combined work at the permanent recharge rate while preserving progress already earned.
  const currentReadyAt = context.cooldownController.readyAt(arcaneEcho.id) ?? at;
  const progress = context.cooldownController.rechargeFor(arcaneEcho.id);
  const work = progress
    ? context.cooldownController.remaining(arcaneEcho, progress, at)
    : Math.max(0, currentReadyAt - at) * context.cooldownController.rate(arcaneEcho);
  context.cooldownController.startRecharge(arcaneEcho, at, work + addedWork);
}
