import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { castWasInterrupted } from '#gw2/platform/execution/cast-timing.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { methodOfMadnessDamage, triggerMethodOfMadness } from '#gw2/professions/mesmer/core/traits/chaos/index.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import {
  createMesmerActions,
  createMesmerSkillEffects,
  dispatchShatterResolved,
  mesmerShatterDefinition
} from '#gw2/professions/mesmer/family-mechanics.js';
import { mesmerActivePrimaryWeapon } from '#gw2/professions/mesmer/family-resources.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

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

/** Summon ownership survives interruption only when the canonical summon instant was reached. */
export function isCommittedInterruptedPhantasm(
  cast: Pick<RuntimeCast<MesmerSkill>, 'start' | 'fullEnd' | 'effectiveEnd'>,
  skill: Pick<MesmerSkill, 'phantasmSummonProgress'>
): boolean {
  const progress = Number(skill.phantasmSummonProgress);
  if (!Number.isFinite(progress) || !castWasInterrupted(cast)) return false;
  const summonAt = canonicalTime(cast.start + (cast.fullEnd - cast.start) * progress);
  return canonicalTime(cast.effectiveEnd) >= summonAt;
}

/** Registers phantasm packets at cast start so observers see their authored timeline in order. */
export function scheduleMesmerPhantasmEffects(
  context: MesmerRuntime,
  cast: RuntimeCast<MesmerSkill>,
  skill: MesmerSkill
): void {
  const details = context.profession.core.castDetails.get(cast.id) || {};
  const completedInterruptedPhantasm = isCommittedInterruptedPhantasm(cast, skill);
  createMesmerSkillEffects(context).schedule(skill, cast.fullEnd, cast.start, {
    clarityConsumed: Boolean(details.clarityConsumed),
    delivery: mesmerCastDelivery(cast, skill, completedInterruptedPhantasm ? Infinity : cast.effectiveEnd),
    ...(completedInterruptedPhantasm ? { phantasmSummonAt: cast.effectiveEnd, playerEffectEnd: cast.effectiveEnd } : {})
  });
}

/** A declared shatter commits exactly one resource transaction while its projectiles retain their own timeline. */
export function commitMesmerShatter(context: MesmerRuntime, cast: RuntimeCast<MesmerSkill>): void {
  const skill = cast.skill;
  const details = context.profession.core.castDetails.get(cast.id)!;
  if (details.reservedShatterResources && !details.shatterSpendCommitted) {
    details.shatterSpent = createMesmerActions(context).commitReservedResources(
      context.time,
      details.shatterSpent ?? 0,
      {
        activationId: cast.id
      }
    );
    details.shatterSpendCommitted = true;
  }

  const delivery = mesmerCastDelivery(cast, skill, Infinity);
  const resolution = createMesmerActions(context).handleShatter(
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
  const details = context.profession.core.castDetails.get(cast.id) || {};
  const at = context.time;
  const interrupted = castWasInterrupted(cast);
  if (interrupted && details.earlyResourceAt != null && canonicalTime(cast.effectiveEnd) < details.earlyResourceAt) {
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
      createMesmerActions(context).restoreReservedResources(details.shatterSpent || 0);
      return;
    }

    // Cancelled attempts still refund reservations and clear cast-local state, but grant no completion effects.
    if (cast.cancelled) return;

    if (skill.id === SHARED_SKILL_IDS.SWAP_WEAPONS) return;
    if (
      !mesmerShatterDefinition(context, skill.id) &&
      !skill.phantasm &&
      !skill.ambush &&
      !skill.instrument &&
      !details.resourceScheduledDuringCast
    ) {
      createMesmerSkillEffects(context).scheduleResources(
        skill,
        skill.resource?.timingAnchor === 'castEnd' ? cast.fullEnd : at,
        cast.start,
        delivery
      );
    }

    triggerMethodOfMadness({ state: context }, skill, at, methodOfMadnessDamage(context), delivery);
  } finally {
    context.profession.core.castDetails.delete(cast.id);
  }
}

/**
 * Reserves or consumes shatter resources at the correct cast progress and
 * stores cast-local details for completion or interruption handling.
 */
export function startMesmerCast(context: MesmerRuntime, cast: RuntimeCast<MesmerSkill>, skill: MesmerSkill): void {
  const shatter = mesmerShatterDefinition(context, skill.id);
  let shatterSpent = null;
  const spendProgress = Number(shatter?.resourceSpendProgress);
  const delayedResourceSpend =
    shatter?.consumesResources !== false &&
    Number.isFinite(spendProgress) &&
    canonicalTime(cast.fullEnd) > canonicalTime(cast.start);
  // Resource eligibility and queued payloads must agree on the scheduler's exact instant.
  const earlyResourceAt =
    skill.resource?.mode === 'add' && skill.resource.timingAnchor === 'castStart'
      ? canonicalTime(cast.start + (skill.resource.atMs || 0) / 1000)
      : null;
  const resourceScheduledDuringCast = earlyResourceAt != null && earlyResourceAt < canonicalTime(cast.fullEnd);
  const earlyResourceOwnerId = `${cast.id}:mesmer.resource`;
  if (resourceScheduledDuringCast && earlyResourceAt <= canonicalTime(cast.effectiveEnd)) {
    // Cast-start resource packets must resolve during the cast so concurrent shatters can consume them.
    context.schedule(
      'mesmer.resource-gain',
      earlyResourceAt,
      {
        at: earlyResourceAt,
        count: skill.resource?.count || 0,
        weapon: skill.weapon || mesmerActivePrimaryWeapon(context),
        reason: skill.name,
        cause: { kind: 'skill', sourceSkillId: skill.id }
      },
      { id: earlyResourceOwnerId, generation: 0 }
    );
  }

  if (delayedResourceSpend) {
    shatterSpent = createMesmerActions(context).reserveResources();
  } else if (shatter && shatter.consumesResources !== false) {
    shatterSpent = createMesmerActions(context).consumeResources(cast.start, {
      activationId: cast.id
    });
  }

  context.profession.core.castDetails.set(cast.id, {
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
      canonicalTime(Math.min(cast.effectiveEnd, cast.start + (cast.fullEnd - cast.start) * spendProgress)),
      cast.id,
      undefined,
      -110
    );
  }
}
