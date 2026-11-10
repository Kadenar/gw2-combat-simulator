import { requireBalanceNumber } from '#gw2/platform/effects/validation.js';
import { denySkillCast } from '#gw2/platform/execution/availability.js';
import type { AvailabilityResult } from '#gw2/platform/execution/availability.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { skillFlipVisible } from '#gw2/platform/execution/skill-flips.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';

/** Each preparation stays flipped until triggered; its trigger waits out the recharge-scaled arming delay. */
export function thiefTrapAvailability(
  runtime: MechanicQueriesOf<ThiefRuntime>,
  skill: ThiefSkill
): AvailabilityResult | null {
  if (skill.skillFamily !== 'Preparation') return null;

  const preparing = skill.flipSkillId != null;
  const triggerId = skill.flipSkillId ?? skill.id;
  const trigger = runtime.helpers.skillsById.get(triggerId)!;
  const window = runtime.flips[triggerId];

  if (preparing && skillFlipVisible(window, runtime.time))
    return denySkillCast(skill, 'thief.preparation-prepared', `activate ${trigger.name} before preparing it again.`);

  if (!preparing && !skillFlipVisible(window, runtime.time))
    return denySkillCast(skill, 'thief.preparation', `prepare ${trigger.name} first.`);

  if (!preparing && window.availableAt > runtime.time)
    return denySkillCast(skill, 'thief.preparation-arming', 'the preparation is still arming.', window.availableAt);

  return null;
}

/** A committed placement exposes its trigger immediately; the trigger arms after a recharge-scaled delay. */
export function prepareTrap(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  const skill = cast.skill;
  const triggerId = skill.flipSkillId;

  if (triggerId == null) return;

  // The placement owns its arming duration; missing selected tuning must never fall back to a default.
  const delay =
    requireBalanceNumber(skill.duration, `skill=${skill.id} field=duration`) / runtime.cooldownController.rate(skill);

  runtime.armFlip(triggerId, { availableAt: runtime.time + delay, expiresAt: Infinity, visibleAt: runtime.time });
}

/** Triggering consumes the trap and mirrors its short rearm onto an already-recharged placement skill. */
export function activateTrap(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  const prepareId = cast.skill.flipParentId;

  if (prepareId == null) return;

  runtime.consumeFlip(cast.skill.id);
  const triggerReadyAt = runtime.cooldownController.readyAt(cast.skill.id);

  if (triggerReadyAt == null || triggerReadyAt <= (runtime.cooldownController.readyAt(prepareId) || 0)) return;

  const placement = runtime.helpers.skillsById.get(prepareId);

  if (placement) runtime.cooldownController.startRecharge(placement, cast.rechargeStart, cast.rechargeWork);
}
