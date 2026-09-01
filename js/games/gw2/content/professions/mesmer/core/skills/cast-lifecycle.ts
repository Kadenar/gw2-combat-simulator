/** Commits Core Mesmer shatters, flips, phantasms, skill effects, and cast-local resource state. */
import { balanceProfileValueFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { EPSILON } from '#kernel/core/clock.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/content/professions/mesmer/data/ids.js';
import type { MesmerCastContext, MesmerShatterResolution } from '#gw2/content/professions/mesmer/types.js';
import { mesmerRuntimeFor } from '#gw2/content/professions/mesmer/core/mechanics/runtime.js';
import { MESMER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/mesmer/core/profiles.js';

import type { MesmerSkill } from '#gw2/content/professions/mesmer/data/types.js';

/**
 * Commits all completion-time Mesmer mechanics for a skill.
 *
 * This includes interrupted resource restoration, profession actions,
 * autoattack chains, flips, phantasms, specialization controllers, trait
 * events, and signet task scheduling.
 *
 * @param {object} context Scheduler cast-completion context.
 * @param {object} skill Completed or interrupted skill.
 * @returns {void}
 */
/** Notifies the active specialization after Core has committed a shatter's exact resource spend. */
function dispatchShatterResolved(context: MesmerCastContext, resolution: MesmerShatterResolution): void {
  for (const handler of mesmerRuntimeFor(context).shatterResolvedHandlers) {
    handler(context, resolution);
  }
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
    const flip = {
      availableAt: context.start + Number(armedFlip.flipDelay || 0),
      expiresAt: context.start + Number(armedFlip.flipDuration || 0)
    };
    if (flip.expiresAt >= at - EPSILON) {
      professionCoreState(state).availableFlips[armedFlip.id] = flip;
      if (armedFlip.id === ID.COUNTERSPELL) {
        professionCoreState(state).counterspellAvailable = true;
      }
    }
  }

  const flipParentId = skill.mesmerMechanic?.flipParentId;
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

function applyMimicCompletion(context: MesmerCastContext, skill: MesmerSkill, at: number): void {
  const runtime = mesmerRuntimeFor(context);
  const { state } = context;
  const core = professionCoreState(state);
  const mimicUntil = Number(core.traitReadyAt.mimicUntil || 0);
  if (skill.id === ID.MIMIC) {
    core.traitReadyAt.mimicUntil =
      at + balanceProfileValueFromContext(context, PROFILE.mimic, 'durationMultiplier', 10);
  } else if (
    skill.type === 'Utility' &&
    !skill.mesmerMechanic?.flipParentId &&
    mimicUntil > 0 &&
    mimicUntil >= context.start - EPSILON
  ) {
    state.cooldowns.delete(skill.id);
    core.traitReadyAt.mimicUntil = 0;
    runtime.addEvent({
      type: 'proc',
      at,
      source: 'Mimic',
      sourceId: ID.MIMIC,
      skillId: ID.MIMIC,
      skillName: 'Mimic',
      name: 'Mimic',
      targetSkillId: skill.id,
      targetSkillName: skill.name,
      reduction: context.rechargeDuration
    });
  }
}

function emitCompletionEvents(
  context: MesmerCastContext,
  skill: MesmerSkill,
  at: number,
  clarityConsumed: boolean
): void {
  const runtime = mesmerRuntimeFor(context);
  const disabled = runtime.controlSkills.has(skill.id) || (skill.id === ID.MENTAL_COLLAPSE && clarityConsumed);
  if (disabled && !runtime.instruments[skill.id]) {
    runtime.addEvent({
      type: 'control',
      at,
      source: 'Player',
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name
    });
  }

  if (runtime.blindSkills.has(skill.id)) {
    runtime.addEvent({ type: 'blind', at, skillName: skill.name });
  }

  if (runtime.aristocracySkills.has(skill.id)) {
    runtime.addEvent({
      type: 'weakness_vulnerability',
      at,
      skillName: skill.name
    });
  }

  if (runtime.peithaSkills.has(skill.id)) {
    // Movement skills trigger Peitha on activation rather than at cast end.
    runtime.addEvent({
      type: 'peitha',
      at: context.start,
      projectileDelay: runtime.peithaProjectileDelays[skill.id] ?? 0,
      skillName: skill.name
    });
  }
}

function completeMesmerSkill(context: MesmerCastContext, skill: MesmerSkill): void {
  const runtime = mesmerRuntimeFor(context);
  const details = runtime.castDetails.get(context.reservationId) || {};
  const at = context.fullEnd;
  const interrupted = context.effectiveEnd < context.fullEnd - EPSILON;
  if (interrupted && details.earlyResourceAt != null && context.effectiveEnd < details.earlyResourceAt - EPSILON) {
    context.tasks.cancelOwner(details.earlyResourceOwnerId || '');
  }

  const phantasmSummonProgress = Number(skill.phantasmSummonProgress);
  const phantasmSummonThreshold = context.start + (context.fullEnd - context.start) * phantasmSummonProgress;
  const completedInterruptedPhantasm =
    interrupted && Number.isFinite(phantasmSummonProgress) && context.effectiveEnd >= phantasmSummonThreshold - EPSILON;
  runtime.activeEmission = {
    skill,
    effectiveEnd: interrupted && !completedInterruptedPhantasm ? context.effectiveEnd : Infinity,
    activationId: context.reservationId
  };
  try {
    if (details.reservedShatterResources && context.effectiveEnd < context.fullEnd - EPSILON) {
      runtime.actions.restoreReservedResources(Number(details.shatterSpent || 0));
      return;
    }

    if (skill.id === ID.SWAP_WEAPONS) return;
    let clarityConsumed = false;
    const specializationHandled = dispatchSpecializationCompletion(context, skill, at);

    if (specializationHandled) {
      // The active specialization committed the replacing skill behavior.
    } else if (runtime.shatters[skill.id]) {
      const resolution = runtime.actions.handleShatter(context, skill, at, details.shatterSpent ?? null, context.start);
      if (resolution) dispatchShatterResolved(context, resolution);
    } else {
      if (skill.mesmerEffects) {
        clarityConsumed = runtime.skillEffects.schedule(
          { ...skill, effects: skill.mesmerEffects },
          at,
          context.start,
          completedInterruptedPhantasm
            ? {
                phantasmSummonAt: context.effectiveEnd,
                playerEffectEnd: context.effectiveEnd,
                skipDirectResource: details.resourceScheduledDuringCast
              }
            : {
                skipDirectResource: details.resourceScheduledDuringCast
              }
        );
      }

      settleSkillFlips(context, skill, at);
    }

    applyMimicCompletion(context, skill, at);
    emitCompletionEvents(context, skill, at, clarityConsumed);
  } finally {
    runtime.activeEmission = null;
    runtime.castDetails.delete(context.reservationId);
  }
}

/**
 * Reserves or consumes shatter resources at the correct cast progress and
 * stores cast-local details for completion or interruption handling.
 *
 * @param {object} context Scheduler cast-start context.
 * @param {object} skill Skill beginning its cast.
 * @returns {void}
 */
export function startMesmerCast(context: MesmerCastContext, skill: MesmerSkill): void {
  const runtime = mesmerRuntimeFor(context);
  const shatter = runtime.shatters[skill.id];
  let shatterSpent = null;
  const spendProgress = Number(shatter?.resourceSpendProgress);
  const delayedResourceSpend =
    shatter?.consumesResources !== false && Number.isFinite(spendProgress) && context.fullEnd > context.start + EPSILON;
  const earlyResourceAt =
    skill.resource?.mode === 'add' && skill.resource.timingAnchor === 'castStart'
      ? context.start + Number(skill.resource.atMs || 0) / 1000 + EPSILON
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
    earlyResourceAt,
    earlyResourceOwnerId,
    resourceScheduledDuringCast,
    reservedShatterResources: delayedResourceSpend,
    shatterSpendCommitted: !delayedResourceSpend,
    shatterSpent
  });
  if (delayedResourceSpend) {
    context.tasks.schedule({
      type: 'mesmer.blade-spend',
      at: spendProgress === 1 ? context.fullEnd : context.start + (context.fullEnd - context.start) * spendProgress,
      // Run before the core cast-completion task (-100) when the spend is
      // scheduled exactly at fullEnd, so completion receives the spent count.
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

/**
 * Public cast-completion hook that delegates to the Mesmer runtime processor.
 *
 * @param {object} context Scheduler cast-completion context.
 * @param {object} skill Completed or interrupted skill.
 * @returns {void}
 */
export function completeMesmerCast(context: MesmerCastContext, skill: MesmerSkill): void {
  completeMesmerSkill(context, skill);
}
