import { gw2BaseRecharge } from '#gw2/platform/engine/skills/recharge.js';
import { mesmerRechargeWork } from '#gw2/professions/mesmer/core/mechanics/recharge.js';
import { armSkillFlip, consumeSkillFlip } from '#gw2/platform/engine/skills/skill-flips.js';
import { canonicalTime, EPSILON } from '#kernel/core/clock.js';
/** Commits Core Mesmer shatters, flips, phantasms, skill effects, and cast-local resource state. */
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { cancelledBeforeInterruptCommit } from '#gw2/platform/execution/effect-adapter.js';
import type { MesmerShatterResolution } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
import { mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { scheduleBountifulBlades } from '#gw2/professions/mesmer/core/traits/index.js';
import { detonateInspiringImagery } from '#gw2/professions/mesmer/core/mechanics/rifle.js';

import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { castWasInterrupted } from '#gw2/platform/skills/timing.js';

/** Notifies the active specialization after Core has committed a shatter's exact resource spend. */
function dispatchShatterResolved(context: MesmerRuntime, resolution: MesmerShatterResolution): void {
  for (const handler of mesmerMechanicsFor(context).shatterResolvedHandlers) {
    handler(context, resolution);
  }
}

/** Registers procedural packets with cast attribution while preserving interruption filtering. */
export function withMesmerCastEmission(
  context: MesmerRuntime,
  cast: RuntimeCast,
  skill: MesmerSkill,
  emit: () => void,
  interruptedEnd = cast.effectiveEnd
): void {
  const runtime = mesmerMechanicsFor(context);
  const previousEmission = runtime.activeEmission;
  const interrupted = castWasInterrupted(cast);
  runtime.activeEmission = {
    skill,
    effectiveEnd: interrupted ? interruptedEnd : Infinity,
    activationId: cast.id,
    offTarget: cast.command.offTarget
  };
  try {
    emit();
  } finally {
    runtime.activeEmission = previousEmission;
  }
}

/** Recognizes interrupted casts that reached their authored summon point using the caller's phase tolerance. */
export function isCommittedInterruptedPhantasm(
  cast: Pick<RuntimeCast, 'start' | 'fullEnd' | 'effectiveEnd'>,
  skill: Pick<MesmerSkill, 'phantasmSummonProgress'>
): boolean {
  const progress = Number(skill.phantasmSummonProgress);
  const summonAt = cast.start + (cast.fullEnd - cast.start) * progress;
  return castWasInterrupted(cast) && Number.isFinite(progress) && cast.effectiveEnd >= summonAt - EPSILON;
}

/** Registers phantasm packets at cast start so observers see their authored timeline in order. */
export function scheduleMesmerPhantasmEffects(context: MesmerRuntime, cast: RuntimeCast, skill: MesmerSkill): void {
  const runtime = mesmerMechanicsFor(context);
  const details = runtime.castDetails.get(cast.id) || {};
  const completedInterruptedPhantasm = isCommittedInterruptedPhantasm(cast, skill);
  withMesmerCastEmission(
    context,
    cast,
    skill,
    () =>
      runtime.skillEffects.schedule(skill, cast.fullEnd, cast.start, {
        clarityConsumed: Boolean(details.clarityConsumed),
        ...(completedInterruptedPhantasm
          ? { phantasmSummonAt: cast.effectiveEnd, playerEffectEnd: cast.effectiveEnd }
          : {})
      }),
    completedInterruptedPhantasm ? Infinity : cast.effectiveEnd
  );
}

// Completion steps remain named and ordered so specialization dispatch and
// interruption-sensitive state cannot be moved past Core effects accidentally.
function dispatchSpecializationCompletion(
  context: MesmerRuntime,
  cast: RuntimeCast,
  skill: MesmerSkill,
  at: number
): boolean {
  for (const handler of mesmerMechanicsFor(context).skillCompletionHandlers) {
    const result = handler(context, cast, skill, at);
    if (result === false) continue;
    if (typeof result === 'object') dispatchShatterResolved(context, result);
    return true;
  }

  return false;
}

export function settleMesmerSkillFlips(
  context: MesmerRuntime,
  cast: RuntimeCast,
  skill: MesmerSkill,
  at: number
): void {
  const runtime = mesmerMechanicsFor(context);
  const state = context;
  const armedFlip = runtime.flipSkillsByParent.get(skill.id);
  if (armedFlip && Number(armedFlip.ammo) > 0) {
    armSkillFlip(professionCoreState(state).availableFlips, armedFlip.id, at);
    state.ammo.delete(armedFlip.id);
    context.cooldownController.clear(armedFlip.id);
    context.cooldownController.ensureAmmo(armedFlip, at);
  } else if (armedFlip) {
    // Canonical exact deadlines keep flip availability and expiry tasks on the same clock; Abstraction starts at creation.
    const flipStart = armedFlip.id === ID.ABSTRACTION ? at : cast.start;
    const flip = {
      availableAt: canonicalTime(flipStart + Number(armedFlip.flipDelay || 0)),
      expiresAt: canonicalTime(flipStart + Number(armedFlip.flipDuration || 0))
    };
    if (flip.expiresAt > canonicalTime(at)) {
      armSkillFlip(
        professionCoreState(state).availableFlips,
        armedFlip.id,
        flip.availableAt,
        flip.expiresAt,
        Math.min(at, flip.availableAt),
        cast.id
      );
      context.schedule('mesmer.flip-expire', flip.expiresAt, { id: armedFlip.id, identity: cast.id }, undefined, 50);
    }
  }

  const flipParentId = skill.flipParentId;
  if (!flipParentId) return;

  const flipAmmo = state.ammo.get(skill.id);
  if (flipAmmo?.maximum) {
    if (flipAmmo.charges <= 0) {
      consumeSkillFlip(professionCoreState(state).availableFlips, skill.id);
      state.ammo.delete(skill.id);
      context.cooldownController.clear(skill.id);
    }
  } else {
    consumeSkillFlip(professionCoreState(state).availableFlips, skill.id);
  }

  if (skill.parentCooldownIncrease) {
    const parent = runtime.skillsById.get(flipParentId);
    const parentReadyAt = parent ? state.cooldowns.get(parent.id) : null;
    if (parent && parentReadyAt != null) {
      const progress = state.rechargeProgress.get(parent.id);
      const rate = context.cooldownController.rate(parent);
      const work = progress
        ? context.cooldownController.remaining(parent, progress, at)
        : Math.max(0, parentReadyAt - at) * rate;
      context.cooldownController.startRecharge(
        parent,
        at,
        work + mesmerRechargeWork(context, parent, gw2BaseRecharge(parent)) * Number(skill.parentCooldownIncrease)
      );
    }
  }
}

/** Commits skill effects and resources, restoring interrupted reservations and clearing cast-local state. */
export function completeMesmerCast(context: MesmerRuntime, cast: RuntimeCast, skill: MesmerSkill): void {
  const runtime = mesmerMechanicsFor(context);
  const details = runtime.castDetails.get(cast.id) || {};
  const at = cast.fullEnd;
  const interrupted = castWasInterrupted(cast);
  if (interrupted && details.earlyResourceAt != null && cast.effectiveEnd < details.earlyResourceAt - EPSILON) {
    context.cancelOwner({ id: details.earlyResourceOwnerId!, generation: 0 });
  }

  const completedInterruptedPhantasm = isCommittedInterruptedPhantasm(cast, skill);
  // A committed bladesong keeps its projectile train and completion reactions on their authored timeline.
  const committedBladesong = details.reservedShatterResources && details.shatterSpendCommitted;
  runtime.activeEmission = {
    skill,
    effectiveEnd: interrupted && !completedInterruptedPhantasm && !committedBladesong ? cast.effectiveEnd : Infinity,
    activationId: cast.id,
    offTarget: cast.command.offTarget
  };
  try {
    if (details.reservedShatterResources && !details.shatterSpendCommitted) {
      runtime.actions.restoreReservedResources(Number(details.shatterSpent || 0));
      return;
    }

    // Cancelled attempts still refund reservations and clear cast-local state, but grant no completion effects.
    if (cancelledBeforeInterruptCommit(skill, cast.start, cast.fullEnd, cast.effectiveEnd)) return;

    if (skill.id === ID.SWAP_WEAPONS) return;
    const specializationHandled = dispatchSpecializationCompletion(context, cast, skill, at);

    if (specializationHandled) {
      // The active specialization committed the replacing skill behavior.
    } else if (runtime.shatters[skill.id]) {
      const resolution = runtime.actions.handleShatter(context, skill, at, details.shatterSpent ?? null, cast.start);
      if (resolution) dispatchShatterResolved(context, resolution);
    } else {
      // Default and augmented profiles still leave direct resource scheduling to Mesmer completion.
      if (!skill.phantasm && !skill.ambush && !skill.instrument && !details.resourceScheduledDuringCast) {
        runtime.skillEffects.scheduleResources(skill, at, cast.start);
      }
    }

    runtime.skillEffects.complete(skill, at, cast.start);
  } finally {
    runtime.activeEmission = null;
    runtime.castDetails.delete(cast.id);
  }
}

/**
 * Reserves or consumes shatter resources at the correct cast progress and
 * stores cast-local details for completion or interruption handling.
 */
export function startMesmerCast(context: MesmerRuntime, cast: RuntimeCast, skill: MesmerSkill): void {
  const runtime = mesmerMechanicsFor(context);
  if (
    skill.id === ID.ABSTRACTION &&
    !cancelledBeforeInterruptCommit(skill, cast.start, cast.fullEnd, cast.effectiveEnd)
  )
    detonateInspiringImagery(context, cast);

  withMesmerCastEmission(context, cast, skill, () => scheduleBountifulBlades(context, cast, skill));
  const shatter = runtime.shatters[skill.id];
  let shatterSpent = null;
  const spendProgress = Number(shatter?.resourceSpendProgress);
  const delayedResourceSpend =
    shatter?.consumesResources !== false && Number.isFinite(spendProgress) && cast.fullEnd > cast.start + EPSILON;
  const earlyResourceAt =
    skill.resource?.mode === 'add' && skill.resource.timingAnchor === 'castStart'
      ? cast.start + Number(skill.resource.atMs || 0) / 1000
      : null;
  const resourceScheduledDuringCast = earlyResourceAt != null && earlyResourceAt < cast.fullEnd - EPSILON;
  const earlyResourceOwnerId = `${cast.id}:mesmer.resource`;
  if (resourceScheduledDuringCast && earlyResourceAt! <= cast.effectiveEnd) {
    // Cast-start resource packets must resolve during the cast so concurrent shatters can consume them.
    context.schedule(
      'mesmer.resource-gain',
      earlyResourceAt!,
      {
        at: earlyResourceAt,
        count: Number(skill.resource?.count || 0),
        weapon: skill.weapon || runtime.activePrimaryWeapon(),
        reason: skill.name,
        cause: { kind: 'skill', sourceSkillId: skill.id }
      },
      { id: earlyResourceOwnerId, generation: 0 }
    );
  }

  if (delayedResourceSpend) {
    shatterSpent = runtime.actions.reserveResources();
  } else if (shatter && shatter.consumesResources !== false) {
    shatterSpent = runtime.actions.consumeResources(cast.start, {
      activationId: cast.id
    });
  }

  runtime.castDetails.set(cast.id, {
    clarityConsumed: runtime.skillEffects.consumeClarity(skill, cast.start),
    earlyResourceAt,
    earlyResourceOwnerId,
    resourceScheduledDuringCast,
    reservedShatterResources: delayedResourceSpend,
    shatterSpendCommitted: !delayedResourceSpend,
    shatterSpent
  });
  if (delayedResourceSpend && !cancelledBeforeInterruptCommit(skill, cast.start, cast.fullEnd, cast.effectiveEnd)) {
    context.schedule(
      'mesmer.blade-spend',
      Math.min(cast.effectiveEnd, cast.start + (cast.fullEnd - cast.start) * spendProgress),
      cast.id,
      undefined,
      -110
    );
  }
}
