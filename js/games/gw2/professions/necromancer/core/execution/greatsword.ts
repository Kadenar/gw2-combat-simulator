import { scheduledReaction } from '#gw2/platform/profession-definition/mechanics.js';
import { EPSILON } from '#kernel/core/clock.js';
/**
 * Owns Necromancer greatsword cast behavior, life-force tasks, and Gravedigger cooldown feedback.
 * Greatsword skill fragments remain in `skills/weapons/greatsword.ts`; `index.ts` assigns cast phases.
 */
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import { gainNecromancerLifeForce } from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import type {
  NecromancerCastContext,
  NecromancerSchedulerContext,
  NecromancerSimulationEvent,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';

const GRASPING_DARKNESS_LIFE_FORCE_TASK = 'necromancer.grasping-darkness-life-force';
const NIGHTFALL_LIFE_FORCE_TASK = 'necromancer.nightfall-life-force';

// Resets Gravedigger only after Chilling Scythe produces a committed damage packet.
function chillingScythe(
  context: NecromancerCastContext,
  _skill: NecromancerSkill,
  event: NecromancerSimulationEvent
): void {
  if (event?.type !== 'damage') return;
  context.state.cooldowns.delete(ID.GRAVEDIGGER);
}

// Projects an authored base-cast offset onto the active cast duration before testing interruption commitment.
function committedAtBaseOffset(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  baseOffsetMs: number
): boolean {
  const baseCastMs = Number(skill.castTimeMs || 0);
  const commitProgress = baseCastMs > 0 ? Number(baseOffsetMs) / baseCastMs : 1;
  const commitAt = context.start + (context.fullEnd - context.start) * commitProgress;
  return context.effectiveEnd + EPSILON >= commitAt;
}

// Tests Grasping Darkness against its authored projectile-release commit point.
function graspingDarknessCommitted(context: NecromancerCastContext, skill: NecromancerSkill): boolean {
  return committedAtBaseOffset(context, skill, Number(skill.commitAtMs || 0));
}

// Defers Grasping Darkness life force to a task tied to its committed damage timestamp and reservation.
const graspingDarknessReaction = scheduledReaction<
  NecromancerSchedulerContext,
  {
    readonly skill: NecromancerSkill;
    readonly event: NecromancerSimulationEvent;
    readonly reservationId: string;
  },
  { readonly lifeForceGain: number }
>({
  id: GRASPING_DARKNESS_LIFE_FORCE_TASK,
  select(_context, { skill, event, reservationId }) {
    if (event?.type !== 'damage') return null;
    return {
      id: `${reservationId}:grasping-darkness-life-force`,
      at: event.at,
      ownerId: reservationId,
      payload: { lifeForceGain: Number(skill.lifeForceOnHit || 0) }
    };
  },
  execute(context, at, payload) {
    gainNecromancerLifeForce(context, payload.lifeForceGain, at, 'grasping-darkness-hit');
  }
});

// Schedules one life-force grant for each committed Nightfall pulse without advancing it ahead of damage.
const nightfallReaction = scheduledReaction<
  NecromancerSchedulerContext,
  {
    readonly skill: NecromancerSkill;
    readonly event: NecromancerSimulationEvent;
    readonly reservationId: string;
  },
  { readonly lifeForceGain: number }
>({
  id: NIGHTFALL_LIFE_FORCE_TASK,
  select(_context, { skill, event, reservationId }) {
    if (event?.type !== 'damage') return null;
    return {
      id: `${reservationId}:nightfall-life-force:` + `${Number(event.hitIndex || 1)}`,
      at: event.at,
      ownerId: reservationId,
      payload: { lifeForceGain: Number(skill.lifeForcePerPulse || 0) }
    };
  },
  execute(context, at, payload) {
    gainNecromancerLifeForce(context, payload.lifeForceGain, at, 'nightfall-pulse');
  }
});

/** Exposes greatsword cast hooks by handler ID for root execution composition. */
export const necromancerGreatswordSkillHandlers = Object.freeze({
  'necromancer.chilling-scythe': chillingScythe,
  'necromancer.grasping-darkness': Object.freeze({
    committed: graspingDarknessCommitted,
    afterEffect: (context: NecromancerCastContext, skill: NecromancerSkill, event: NecromancerSimulationEvent) =>
      graspingDarknessReaction.onEventScheduled.handler(context, { skill, event, reservationId: context.reservationId })
  }),
  'necromancer.nightfall': Object.freeze({
    afterEffect: (context: NecromancerCastContext, skill: NecromancerSkill, event: NecromancerSimulationEvent) =>
      nightfallReaction.onEventScheduled.handler(context, { skill, event, reservationId: context.reservationId })
  })
});

/** Exposes greatsword-owned scheduled callbacks to Core module composition. */
export const necromancerGreatswordTaskHandlers = Object.freeze({
  ...graspingDarknessReaction.taskHandlers,
  ...nightfallReaction.taskHandlers
});

/** Applies Core greatsword cooldown feedback after the target crosses half health. */
export const necromancerGreatswordSkillMechanicHandlers = Object.freeze({
  'necromancer.core.reset-gravedigger-below-half': ({
    context,
    at
  }: {
    context: NecromancerSchedulerContext;
    at: number;
  }): void => {
    const schedulerFeedback = context.config._schedulerFeedback as { readonly targetBelowHalfAt?: number } | undefined;
    const targetBelowHalfAt = Number(schedulerFeedback?.targetBelowHalfAt);
    if (Number.isFinite(targetBelowHalfAt) && at > targetBelowHalfAt + EPSILON) {
      context.state.cooldowns.delete(ID.GRAVEDIGGER);
    }
  }
});
