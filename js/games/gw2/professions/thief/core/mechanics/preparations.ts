import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';

import { denySkillCast } from '#gw2/platform/execution/availability.js';
import { armSkillFlip, consumeSkillFlip, skillFlipVisible } from '#gw2/platform/execution/skill-flips.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';

import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';

interface TrapDefinition {
  readonly prepareId: SkillId;
  readonly triggerId: SkillId;
  readonly name: string;
  readonly reason: string;
}

export const THIEF_PREPARATIONS: readonly TrapDefinition[] = Object.freeze([
  {
    prepareId: ID.PREPARE_THOUSAND_NEEDLES,
    triggerId: ID.THOUSAND_NEEDLES,
    name: 'Thousand Needles',
    reason: 'thousand-needles'
  },
  { prepareId: ID.PREPARE_PITFALL, triggerId: ID.PITFALL, name: 'Pitfall', reason: 'pitfall' }
]);

/** Each preparation stays flipped until triggered; its trigger waits out the recharge-scaled arming delay. */
export function thiefTrapAvailability(
  runtime: MechanicQueriesOf<ThiefRuntime>,
  skill: ThiefSkill
): AvailabilityResult | null {
  const trap = THIEF_PREPARATIONS.find(
    (candidate) => candidate.prepareId === skill.id || candidate.triggerId === skill.id
  );
  if (!trap) return null;
  const window = runtime.profession.core.availableFlips[trap.triggerId];
  if (skill.id === trap.prepareId && skillFlipVisible(window, runtime.time))
    return denySkillCast(skill, `thief.${trap.reason}-prepared`, `activate ${trap.name} before preparing it again.`);
  if (skill.id === trap.triggerId && !skillFlipVisible(window, runtime.time))
    return denySkillCast(skill, `thief.${trap.reason}`, `prepare ${trap.name} first.`);
  if (skill.id === trap.triggerId && window.availableAt > runtime.time)
    return denySkillCast(skill, `thief.${trap.reason}-arming`, 'the preparation is still arming.', window.availableAt);
  return null;
}

/** A committed placement exposes its trigger immediately; the trigger arms after a recharge-scaled delay. */
export function prepareTrap(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  const trap = THIEF_PREPARATIONS.find((candidate) => candidate.prepareId === cast.skill.id);
  if (!trap) return;
  const skill = cast.skill;
  const delay = Number(skill.durationMultiplier ?? 3) / runtime.cooldownController.rate(cast.skill);
  armSkillFlip(runtime.profession.core.availableFlips, trap.triggerId, runtime.time + delay, Infinity, runtime.time);
}

/** Triggering consumes the trap and mirrors its short rearm onto an already-recharged placement skill. */
export function activateTrap(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  const trap = THIEF_PREPARATIONS.find((candidate) => candidate.triggerId === cast.skill.id);
  if (!trap) return;
  consumeSkillFlip(runtime.profession.core.availableFlips, trap.triggerId);
  const triggerReadyAt = runtime.cooldownController.readyAt(trap.triggerId);
  if (triggerReadyAt == null || triggerReadyAt <= (runtime.cooldownController.readyAt(trap.prepareId) || 0)) return;
  const placement = runtime.helpers.skillsById.get(trap.prepareId);
  if (placement) runtime.cooldownController.startRecharge(placement, cast.rechargeStart, cast.rechargeWork);
}
