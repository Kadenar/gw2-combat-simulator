import { EPSILON } from '#kernel/core/clock.js';
/** Commits Core Mesmer shatters, flips, phantasms, skill effects, and cast-local resource state. */
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerCastContext } from '#gw2/professions/mesmer/types.js';
import type { MesmerShatterResolution } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
import { mesmerRuntimeFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { scheduleBountifulBlades } from '#gw2/professions/mesmer/core/traits/index.js';
import { detonateInspiringImagery } from '#gw2/professions/mesmer/core/mechanics/rifle.js';

import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { scheduleDeclarativeEffects } from '#gw2/platform/engine/execution/scheduler.js';
import { castWasInterrupted } from '#gw2/platform/skills/timing.js';

/** Notifies the active specialization after Core has committed a shatter's exact resource spend. */
function dispatchShatterResolved(context: MesmerCastContext, resolution: MesmerShatterResolution): void {
  for (const handler of mesmerRuntimeFor(context).shatterResolvedHandlers) {
    handler(context, resolution);
  }
}

/** Registers procedural packets with cast attribution while preserving interruption filtering. */
export function withMesmerCastEmission(
  context: MesmerCastContext,
  skill: MesmerSkill,
  emit: () => void,
  interruptedEnd = context.effectiveEnd
): void {
  const runtime = mesmerRuntimeFor(context);
  const previousEmission = runtime.activeEmission;
  const interrupted = castWasInterrupted(context);
  runtime.activeEmission = {
    skill,
    effectiveEnd: interrupted ? interruptedEnd : Infinity,
    activationId: context.reservationId
  };
  try {
    emit();
  } finally {
    runtime.activeEmission = previousEmission;
  }
}

/** Recognizes interrupted casts that reached their authored summon point using the caller's phase tolerance. */
export function isCommittedInterruptedPhantasm(
  context: Pick<MesmerCastContext, 'start' | 'fullEnd' | 'effectiveEnd'>,
  skill: Pick<MesmerSkill, 'phantasmSummonProgress'>
): boolean {
  const progress = Number(skill.phantasmSummonProgress);
  const summonAt = context.start + (context.fullEnd - context.start) * progress;
  return castWasInterrupted(context) && Number.isFinite(progress) && context.effectiveEnd >= summonAt - EPSILON;
}

/** Registers phantasm packets at cast start so observers see their authored timeline in order. */
export function scheduleMesmerPhantasmEffects(context: MesmerCastContext, skill: MesmerSkill): void {
  const runtime = mesmerRuntimeFor(context);
  const details = runtime.castDetails.get(context.reservationId) || {};
  const completedInterruptedPhantasm = isCommittedInterruptedPhantasm(context, skill);
  withMesmerCastEmission(
    context,
    skill,
    () =>
      runtime.skillEffects.schedule(skill, context.fullEnd, context.start, {
        clarityConsumed: Boolean(details.clarityConsumed),
        ...(completedInterruptedPhantasm
          ? { phantasmSummonAt: context.effectiveEnd, playerEffectEnd: context.effectiveEnd }
          : {})
      }),
    completedInterruptedPhantasm ? Infinity : context.effectiveEnd
  );
}

// Completion steps remain named and ordered so specialization dispatch and
// interruption-sensitive state cannot be moved past Core effects accidentally.
function dispatchSpecializationCompletion(context: MesmerCastContext, skill: MesmerSkill, at: number): boolean {
  for (const handler of mesmerRuntimeFor(context).skillCompletionHandlers) {
    const result = handler(context, skill, at);
    if (result === false) continue;
    if (typeof result === 'object') dispatchShatterResolved(context, result);
    return true;
  }

  return false;
}

function settleSkillFlips(context: MesmerCastContext, skill: MesmerSkill, at: number): void {
  const runtime = mesmerRuntimeFor(context);
  const { state } = context;
  const armedFlip = runtime.flipSkillsByParent.get(skill.id);
  if (armedFlip && context.maximumAmmoFor(armedFlip)) {
    professionCoreState(state).availableFlips[armedFlip.id] = {
      availableAt: at,
      expiresAt: Infinity
    };
    state.ammo.delete(armedFlip.id);
    state.cooldowns.delete(armedFlip.id);
    context.cooldownController.ensureAmmo(armedFlip, at);
  } else if (armedFlip) {
    // Abstraction remains available for the image's full lifetime after creation.
    const flipStart = armedFlip.id === ID.ABSTRACTION ? at : context.start;
    const flip = {
      availableAt: flipStart + Number(armedFlip.flipDelay || 0),
      expiresAt: flipStart + Number(armedFlip.flipDuration || 0)
    };
    if (flip.expiresAt >= at - EPSILON) {
      professionCoreState(state).availableFlips[armedFlip.id] = flip;
      if (armedFlip.id === ID.COUNTERSPELL) {
        professionCoreState(state).counterspellAvailable = true;
      }
    }
  }

  const flipParentId = skill.flipParentId;
  if (!flipParentId) return;

  const flipAmmo = state.ammo.get(skill.id);
  if (flipAmmo?.maximum) {
    if (flipAmmo.charges <= 0) {
      delete professionCoreState(state).availableFlips[skill.id];
      state.ammo.delete(skill.id);
      state.cooldowns.delete(skill.id);
    }
  } else {
    delete professionCoreState(state).availableFlips[skill.id];
  }

  if (skill.id === ID.COUNTERSPELL) {
    professionCoreState(state).counterspellAvailable = false;
  }

  if (skill.parentCooldownIncrease) {
    const parent = runtime.skillsById.get(flipParentId);
    const parentReadyAt = parent ? state.cooldowns.get(parent.id) : null;
    if (parent && parentReadyAt != null) {
      state.cooldowns.set(
        parent.id,
        parentReadyAt + context.rechargeDurationFor(parent, at) * Number(skill.parentCooldownIncrease)
      );
    }
  }
}

/** Commits skill effects and resources, restoring interrupted reservations and clearing cast-local state. */
export function completeMesmerCast(context: MesmerCastContext, skill: MesmerSkill): void {
  const runtime = mesmerRuntimeFor(context);
  const details = runtime.castDetails.get(context.reservationId) || {};
  const at = context.fullEnd;
  const interrupted = castWasInterrupted(context);
  if (interrupted && details.earlyResourceAt != null && context.effectiveEnd < details.earlyResourceAt - EPSILON) {
    context.tasks.cancelOwner(details.earlyResourceOwnerId || '');
  }

  const completedInterruptedPhantasm = isCommittedInterruptedPhantasm(context, skill);
  // A committed bladesong keeps its projectile train and completion reactions on their authored timeline.
  const committedBladesong = details.reservedShatterResources && details.shatterSpendCommitted;
  runtime.activeEmission = {
    skill,
    effectiveEnd: interrupted && !completedInterruptedPhantasm && !committedBladesong ? context.effectiveEnd : Infinity,
    activationId: context.reservationId
  };
  try {
    if (details.reservedShatterResources && !details.shatterSpendCommitted) {
      runtime.actions.restoreReservedResources(Number(details.shatterSpent || 0));
      return;
    }

    // Cancelled attempts still refund reservations and clear cast-local state, but grant no completion effects.
    if (context.action.cancelled) return;

    if (skill.id === ID.SWAP_WEAPONS) return;
    const specializationHandled = dispatchSpecializationCompletion(context, skill, at);

    if (specializationHandled) {
      // The active specialization committed the replacing skill behavior.
    } else if (runtime.shatters[skill.id]) {
      const resolution = runtime.actions.handleShatter(context, skill, at, details.shatterSpent ?? null, context.start);
      if (resolution) dispatchShatterResolved(context, resolution);
    } else {
      // Default and augmented profiles still leave direct resource scheduling to Mesmer completion.
      if ((!skill.handlerId || skill.handlerId === 'mesmer.mind-spike') && !details.resourceScheduledDuringCast) {
        runtime.skillEffects.scheduleResources(skill, at, context.start);
      }

      settleSkillFlips(context, skill, at);
    }

    runtime.skillEffects.complete(skill, at, context.start);
  } finally {
    runtime.activeEmission = null;
    runtime.castDetails.delete(context.reservationId);
  }
}

/**
 * Reserves or consumes shatter resources at the correct cast progress and
 * stores cast-local details for completion or interruption handling.
 */
export function startMesmerCast(context: MesmerCastContext, skill: MesmerSkill): void {
  const runtime = mesmerRuntimeFor(context);
  // Shadowstep activation precedes the attack animation's end; only accepted casts emit the movement fact.
  if (skill.shadowstepSkill && !context.action.cancelled) {
    scheduleDeclarativeEffects(
      context,
      {
        ...skill,
        effects: [{ type: 'custom', eventType: 'shadowstep', event: {}, atMs: 0, timingAnchor: 'castStart' }]
      },
      context.reservationId,
      context.start,
      context.fullEnd,
      context.effectiveEnd
    );
  }

  if (skill.id === ID.ABSTRACTION && !context.action.cancelled) detonateInspiringImagery(context);

  withMesmerCastEmission(context, skill, () => scheduleBountifulBlades(context, skill));
  const shatter = runtime.shatters[skill.id];
  let shatterSpent = null;
  const spendProgress = Number(shatter?.resourceSpendProgress);
  const delayedResourceSpend =
    shatter?.consumesResources !== false && Number.isFinite(spendProgress) && context.fullEnd > context.start + EPSILON;
  const earlyResourceAt =
    skill.resource?.mode === 'add' && skill.resource.timingAnchor === 'castStart'
      ? context.start + Number(skill.resource.atMs || 0) / 1000
      : null;
  const resourceScheduledDuringCast = earlyResourceAt != null && earlyResourceAt < context.fullEnd - EPSILON;
  const earlyResourceOwnerId = `${context.reservationId}:mesmer.resource`;
  if (resourceScheduledDuringCast) {
    // Cast-start resource packets must resolve during the cast so concurrent shatters can consume them.
    context.tasks.schedule({
      type: 'mesmer.resource-gain',
      at: earlyResourceAt,
      ownerId: earlyResourceOwnerId,
      payload: {
        at: earlyResourceAt,
        count: Number(skill.resource?.count || 0),
        weapon: skill.weapon || runtime.activePrimaryWeapon(),
        reason: skill.name,
        cause: { kind: 'skill', sourceSkillId: skill.id }
      }
    });
  }

  if (delayedResourceSpend) {
    shatterSpent = runtime.actions.reserveResources();
  } else if (shatter && shatter.consumesResources !== false) {
    shatterSpent = runtime.actions.consumeResources(context.start, {
      sourceSkill: skill.name,
      rotationIndex: context.commandIndex
    });
  }

  runtime.castDetails.set(context.reservationId, {
    clarityConsumed: runtime.skillEffects.consumeClarity(skill, context.start),
    earlyResourceAt,
    earlyResourceOwnerId,
    resourceScheduledDuringCast,
    reservedShatterResources: delayedResourceSpend,
    shatterSpendCommitted: !delayedResourceSpend,
    shatterSpent
  });
  if (delayedResourceSpend && !context.action.cancelled) {
    context.tasks.schedule({
      type: 'mesmer.blade-spend',
      // Accepted interrupts commit the reservation before completion; cancelled attempts only restore it.
      at: Math.min(context.effectiveEnd, context.start + (context.fullEnd - context.start) * spendProgress),
      // Run before the core cast-completion task (-100) so completion receives the spent count.
      priority: -110,
      ownerId: context.reservationId,
      payload: {
        reservationId: context.reservationId,
        sourceSkill: skill.name,
        rotationIndex: context.commandIndex
      }
    });
  }
}
