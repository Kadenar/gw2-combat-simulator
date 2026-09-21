import { skillFlipVisible, armSkillFlip, consumeSkillFlip } from '#gw2/platform/engine/skills/skill-flips.js';
import { emitThiefStateSnapshot } from '#gw2/professions/thief/family-state.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { denySkillCast as deny } from '#gw2/professions/shared/availability.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type { ThiefCastContext, ThiefPrecastContext, ThiefSkill } from '#gw2/professions/thief/types.js';
import type { ThiefCoreState } from '#gw2/professions/thief/core/state.js';

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
  {
    prepareId: ID.PREPARE_PITFALL,
    triggerId: ID.PITFALL,
    name: 'Pitfall',
    reason: 'pitfall'
  }
]);

/** Arms a preparation after its placement cast while its parent cooldown continues independently. */
export function prepareTrap(context: ThiefCastContext, skill: ThiefSkill): void {
  // A placement cancelled before its commit point must not expose an armed trap.
  if (context.action?.cancelled === true) return;
  const trap = THIEF_PREPARATIONS.find((candidate) => candidate.prepareId === skill.id);
  if (!trap) return;
  const state = professionCoreState(context) as ThiefCoreState;
  const at = context.effectiveEnd;
  // Placement exposes the trigger immediately while its recharge-scaled arming delay still blocks casting.
  const availableAt =
    at + context.rechargeDurationFor({ ...skill, cooldown: Number(skill.durationMultiplier ?? 3) }, at);
  armSkillFlip(state.availableFlips, trap.triggerId, availableAt, Infinity, at);
  emitThiefStateSnapshot(context, at, `prepare-${trap.reason}`);
}

/** Consumes an armed trap and mirrors the trigger's short rearm onto an already-recharged placement skill. */
export function activateTrap(context: ThiefCastContext, skill: ThiefSkill): void {
  const trap = THIEF_PREPARATIONS.find((candidate) => candidate.triggerId === skill.id);
  if (!trap) return;
  const state = professionCoreState(context) as ThiefCoreState;
  consumeSkillFlip(state.availableFlips, trap.triggerId);
  if (context.rechargeReadyAt != null) {
    context.state.cooldowns.set(
      trap.prepareId,
      Math.max(Number(context.state.cooldowns.get(trap.prepareId) || 0), context.rechargeReadyAt)
    );
  }

  emitThiefStateSnapshot(context, context.effectiveEnd, trap.reason);
}

/** Keeps each preparation flipped until triggered and blocks its trigger during the three-second arm window. */
export function thiefTrapCastAvailability(context: ThiefPrecastContext, skill: ThiefSkill): AvailabilityResult | null {
  const trap = THIEF_PREPARATIONS.find(
    (candidate) => candidate.prepareId === skill.id || candidate.triggerId === skill.id
  );
  if (!trap) return null;
  const state = professionCoreState(context) as ThiefCoreState;
  const window = state.availableFlips[trap.triggerId];
  if (skill.id === trap.prepareId && skillFlipVisible(window, context.start)) {
    return deny(skill, `thief.${trap.reason}-prepared`, `activate ${trap.name} before preparing it again.`);
  }

  if (skill.id === trap.triggerId && !skillFlipVisible(window, context.start)) {
    return deny(skill, `thief.${trap.reason}`, `prepare ${trap.name} first.`);
  }

  if (skill.id === trap.triggerId && window.availableAt > context.start) {
    return deny(skill, `thief.${trap.reason}-arming`, 'the preparation is still arming.', window.availableAt);
  }

  return null;
}
