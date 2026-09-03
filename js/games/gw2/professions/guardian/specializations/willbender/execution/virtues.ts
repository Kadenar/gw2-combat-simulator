/** Registers scheduler-phase skill activations for this module. */
import { augmentSkill } from '#gw2/platform/profession-definition/mechanics.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import { emitGuardianEvent } from '#gw2/professions/guardian/core/mechanics/event-handlers.js';
import { guardianVirtueSkillHandlers } from '#gw2/professions/guardian/core/mechanics/virtues.js';
import type { GuardianCastContext, GuardianSkill, GuardianVirtue } from '#gw2/professions/guardian/types.js';
import type { SimulationEvent } from '#gw2/platform/engine/types.js';
import { applyWillbenderVirtueActivationTraits } from '#gw2/professions/guardian/specializations/willbender/mechanics/virtue-rules.js';
import { willbenderState } from '#gw2/professions/guardian/specializations/willbender/state.js';

const FLAME_ID_BY_VIRTUE: Readonly<Record<GuardianVirtue, number>> = Object.freeze({
  justice: ID.WILLBENDER_FLAMES_ID_62618,
  resolve: ID.WILLBENDER_FLAMES,
  courage: ID.WILLBENDER_FLAMES_COURAGE
});

function virtueFor(skill: GuardianSkill): GuardianVirtue | null {
  // Slot strings are "Profession_1/2/3"; the trailing digit maps directly to virtue order.
  const slot = Number(String(skill.slot || '').match(/(\d)$/)?.[1] || 0);
  return ([null, 'justice', 'resolve', 'courage'] as const)[slot] || null;
}

function activateWillbenderVirtue(context: GuardianCastContext, skill: GuardianSkill): void {
  // Run the core virtue handler first (cooldown tracking, passive arming) before
  // willbender-specific overrides; order matters because core sets virtueReadyAt.
  guardianVirtueSkillHandlers['guardian.virtue'](context, skill);
  const virtue = virtueFor(skill);
  if (!virtue) return;

  // Justice impact fires 40 ms before cast end; Courage impact fires after the
  // lunge animation (~520 ms). Resolve has no early hit, so it uses effectiveEnd.
  // Min-clamping ensures these don't overshoot when the cast is interrupted.
  const at =
    virtue === 'justice'
      ? Math.min(context.effectiveEnd, context.start + 0.04)
      : virtue === 'courage'
        ? Math.min(context.effectiveEnd, context.start + 0.52)
        : context.effectiveEnd;
  // For justice the flame spawns at the very end of the skill window, not at impact time,
  // so the pulsing DoT doesn't begin until the physical lunge finishes.
  const flameAt = virtue === 'justice' ? Math.max(at, context.effectiveEnd - 0.04) : at;
  const state = willbenderState.from(context);
  // virtueUntil may still hold the previous window; reset hit counts only when that
  // window has actually expired so a rapid re-activation doesn't wipe an in-progress tally.
  if (state[`${virtue}Until`] <= at + context.epsilon) {
    state.virtueHitCounts[virtue] = 0;
  }

  const duration = applyWillbenderVirtueActivationTraits(context, virtue, at);

  emitGuardianEvent(context, skill, 'guardian.willbender-virtue-activated', {
    at,
    virtue,
    duration
  });
  const flameId = FLAME_ID_BY_VIRTUE[virtue];
  context.tasks.schedule({
    id: `guardian.willbender-flame-activate:${context.reservationId}`,
    type: 'guardian.willbender-flame-activate',
    at: flameAt,
    priority: -10, // run after same-timestamp strike/condition events so flame window opens last
    payload: { flameId, virtue }
  });
}

function decorateWillbenderVirtueEffect(
  context: GuardianCastContext,
  skill: GuardianSkill,
  event: SimulationEvent
): void {
  if (skill.id !== ID.RUSHING_JUSTICE && skill.id !== ID.CRASHING_COURAGE) {
    return;
  }

  context.replaceEvent(event, {
    ...(skill.id === ID.RUSHING_JUSTICE ? { sourceId: ID.RUSHING_JUSTICE_IMPACT } : {}),
    ...(event.type === 'damage' ? { skillWeapon: 'Profession Mechanic' } : {})
  });
}

export const willbenderSkillHandlers = Object.freeze({
  'guardian.willbender-virtue': augmentSkill({
    beforeEffects: activateWillbenderVirtue,
    afterEffect: decorateWillbenderVirtueEffect
  })
});
