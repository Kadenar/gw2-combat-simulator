import { eventReaction } from '#gw2/platform/profession-definition/mechanics.js';
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

// Resets Gravedigger only after Chilling Scythe produces a committed damage packet.
function chillingScythe(
  context: NecromancerCastContext,
  _skill: NecromancerSkill,
  event: NecromancerSimulationEvent
): void {
  if (event?.type !== 'damage') return;
  context.cooldownController.clear(ID.GRAVEDIGGER);
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

/** Grants follow surviving damage, including projectiles committed before a cast is interrupted. */
const greatswordLifeForce = eventReaction<
  NecromancerSchedulerContext,
  NecromancerSimulationEvent,
  { eventOrder: number; amount: number; reason: string }
>({
  id: 'necromancer.greatsword-life-force',
  missingEvent: 'skip',
  select(_context, event) {
    if (event.type !== 'damage') return null;
    return {
      at: event.at,
      payload: { eventOrder: Number(event.eventOrder), amount: Number(event.amount), reason: String(event.reason) }
    };
  },
  execute(context, event, at, payload) {
    if (event.cancelled || event.offTarget) return;
    gainNecromancerLifeForce(context, payload.amount, at, payload.reason);
  }
});

/** Exposes greatsword cast hooks by handler ID for root execution composition. */
export const necromancerGreatswordSkillHandlers = Object.freeze({
  'necromancer.chilling-scythe': chillingScythe,
  'necromancer.grasping-darkness': Object.freeze({
    committed: graspingDarknessCommitted,
    afterEffect: (context: NecromancerCastContext, skill: NecromancerSkill, event: NecromancerSimulationEvent) =>
      greatswordLifeForce.onEventScheduled.handler(context, {
        ...event,
        amount: Number(skill.lifeForceOnHit || 0),
        reason: 'grasping-darkness-hit'
      })
  }),
  'necromancer.nightfall': Object.freeze({
    afterEffect: (context: NecromancerCastContext, skill: NecromancerSkill, event: NecromancerSimulationEvent) =>
      greatswordLifeForce.onEventScheduled.handler(context, {
        ...event,
        amount: Number(skill.lifeForcePerPulse || 0),
        reason: 'nightfall-pulse'
      })
  })
});

/** Exposes greatsword-owned scheduled callbacks to Core module composition. */
export const necromancerGreatswordTaskHandlers = Object.freeze({
  ...greatswordLifeForce.taskHandlers
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
      context.cooldownController.clear(ID.GRAVEDIGGER);
    }
  }
});
