import type { EffectDelivery } from '#gw2/platform/simulation/effect-emission.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { triggerMethodOfMadness } from '#gw2/professions/mesmer/core/traits/behavior.js';
import { EPSILON } from '#kernel/core/clock.js';
/** Commits Core Mesmer shatters, flips, phantasms, skill effects, and cast-local resource state. */
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import type { MesmerShatterResolution } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';

import { castWasInterrupted } from '#gw2/platform/skills/timing.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

/** Notifies the active specialization after Core has committed a shatter's exact resource spend. */
export function dispatchShatterResolved(context: MesmerRuntime, resolution: MesmerShatterResolution): void {
  for (const handler of mesmerMechanicsFor(context).shatterResolvedHandlers) {
    handler(context, resolution);
  }
}

/** Cast ownership is explicit data passed with each effect, never mutable ambient runtime state. */
export function mesmerCastDelivery(
  cast: RuntimeCast<MesmerSkill>,
  skill: MesmerSkill = cast.skill,
  interruptedEnd = cast.effectiveEnd
): EffectDelivery {
  return {
    cast: {
      activationId: cast.id,
      skillId: skill.id,
      effectiveEnd: castWasInterrupted(cast) ? interruptedEnd : Infinity,
      offTarget: cast.command.offTarget,
      independentSourceStrike: true
    }
  };
}

/** Recognizes interrupted casts that reached their authored summon point using the caller's phase tolerance. */
export function isCommittedInterruptedPhantasm(
  cast: Pick<RuntimeCast<MesmerSkill>, 'start' | 'fullEnd' | 'effectiveEnd'>,
  skill: Pick<MesmerSkill, 'phantasmSummonProgress'>
): boolean {
  const progress = Number(skill.phantasmSummonProgress);
  const summonAt = cast.start + (cast.fullEnd - cast.start) * progress;
  return castWasInterrupted(cast) && Number.isFinite(progress) && cast.effectiveEnd >= summonAt - EPSILON;
}

/** Registers phantasm packets at cast start so observers see their authored timeline in order. */
export function scheduleMesmerPhantasmEffects(
  context: MesmerRuntime,
  cast: RuntimeCast<MesmerSkill>,
  skill: MesmerSkill
): void {
  const runtime = mesmerMechanicsFor(context);
  const details = runtime.castDetails.get(cast.id) || {};
  const completedInterruptedPhantasm = isCommittedInterruptedPhantasm(cast, skill);
  runtime.skillEffects.schedule(skill, cast.fullEnd, cast.start, {
    clarityConsumed: Boolean(details.clarityConsumed),
    delivery: mesmerCastDelivery(cast, skill, completedInterruptedPhantasm ? Infinity : cast.effectiveEnd),
    ...(completedInterruptedPhantasm ? { phantasmSummonAt: cast.effectiveEnd, playerEffectEnd: cast.effectiveEnd } : {})
  });
}

/** A declared shatter commits exactly one resource transaction while its projectiles retain their own timeline. */
export function commitMesmerShatter(context: MesmerRuntime, cast: RuntimeCast<MesmerSkill>): void {
  const runtime = mesmerMechanicsFor(context);
  const skill = cast.skill;
  const details = runtime.castDetails.get(cast.id)!;
  if (details.reservedShatterResources && !details.shatterSpendCommitted) {
    details.shatterSpent = runtime.actions.commitReservedResources(context.time, details.shatterSpent ?? 0, {
      activationId: cast.id
    });
    details.shatterSpendCommitted = true;
  }

  const delivery = mesmerCastDelivery(cast, skill, Infinity);
  const resolution = runtime.actions.handleShatter(
    context,
    skill,
    context.time,
    details.shatterSpent ?? null,
    cast.start,
    details.reservedShatterResources ? cast.fullEnd : context.time,
    delivery
  );
  if (resolution) dispatchShatterResolved(context, resolution);
}

/** Commits skill effects and resources, restoring interrupted reservations and clearing cast-local state. */
export function completeMesmerCast(context: MesmerRuntime, cast: RuntimeCast<MesmerSkill>, skill: MesmerSkill): void {
  const runtime = mesmerMechanicsFor(context);
  const details = runtime.castDetails.get(cast.id) || {};
  const at = context.time;
  const interrupted = castWasInterrupted(cast);
  if (interrupted && details.earlyResourceAt != null && cast.effectiveEnd < details.earlyResourceAt - EPSILON) {
    context.cancelOwner({ id: details.earlyResourceOwnerId!, generation: 0 });
  }

  const completedInterruptedPhantasm = isCommittedInterruptedPhantasm(cast, skill);
  // A committed bladesong keeps its projectile train and completion reactions on their authored timeline.
  const committedBladesong = details.reservedShatterResources && details.shatterSpendCommitted;
  const delivery = mesmerCastDelivery(
    cast,
    skill,
    interrupted && !completedInterruptedPhantasm && !committedBladesong ? cast.effectiveEnd : Infinity
  );
  try {
    if (cast.cancelled && details.reservedShatterResources && !details.shatterSpendCommitted) {
      runtime.actions.restoreReservedResources(details.shatterSpent || 0);
      return;
    }

    // Cancelled attempts still refund reservations and clear cast-local state, but grant no completion effects.
    if (cast.cancelled) return;

    if (skill.id === SHARED_SKILL_IDS.SWAP_WEAPONS) return;
    if (
      !runtime.shatters[skill.id] &&
      !skill.phantasm &&
      !skill.ambush &&
      !skill.instrument &&
      !details.resourceScheduledDuringCast
    ) {
      runtime.skillEffects.scheduleResources(
        skill,
        skill.resource?.timingAnchor === 'castEnd' ? cast.fullEnd : at,
        cast.start,
        delivery
      );
    }

    triggerMethodOfMadness({ state: context }, skill, at, runtime.traitDamage['Lesser Chaos Storm'], delivery);
  } finally {
    runtime.castDetails.delete(cast.id);
  }
}

/**
 * Reserves or consumes shatter resources at the correct cast progress and
 * stores cast-local details for completion or interruption handling.
 */
export function startMesmerCast(context: MesmerRuntime, cast: RuntimeCast<MesmerSkill>, skill: MesmerSkill): void {
  const runtime = mesmerMechanicsFor(context);

  const shatter = runtime.shatters[skill.id];
  let shatterSpent = null;
  const spendProgress = Number(shatter?.resourceSpendProgress);
  const delayedResourceSpend =
    shatter?.consumesResources !== false && Number.isFinite(spendProgress) && cast.fullEnd > cast.start + EPSILON;
  const earlyResourceAt =
    skill.resource?.mode === 'add' && skill.resource.timingAnchor === 'castStart'
      ? cast.start + (skill.resource.atMs || 0) / 1000
      : null;
  const resourceScheduledDuringCast = earlyResourceAt != null && earlyResourceAt < cast.fullEnd - EPSILON;
  const earlyResourceOwnerId = `${cast.id}:mesmer.resource`;
  if (resourceScheduledDuringCast && earlyResourceAt <= cast.effectiveEnd) {
    // Cast-start resource packets must resolve during the cast so concurrent shatters can consume them.
    context.schedule(
      'mesmer.resource-gain',
      earlyResourceAt,
      {
        at: earlyResourceAt,
        count: skill.resource?.count || 0,
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
    earlyResourceAt,
    earlyResourceOwnerId,
    resourceScheduledDuringCast,
    reservedShatterResources: delayedResourceSpend,
    shatterSpendCommitted: !delayedResourceSpend,
    shatterSpent
  });
  if (delayedResourceSpend && !cast.cancelled) {
    context.schedule(
      'mesmer.blade-spend',
      Math.min(cast.effectiveEnd, cast.start + (cast.fullEnd - cast.start) * spendProgress),
      cast.id,
      undefined,
      -110
    );
  }
}
