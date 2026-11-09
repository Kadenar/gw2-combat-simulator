import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { castWasInterrupted } from '#gw2/platform/execution/cast-timing.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { scheduleDirectSkillResources } from '#gw2/professions/mesmer/core/mechanics/illusions/resources.js';
import { mesmerHealCompleted } from '#gw2/professions/mesmer/core/mechanics/trigger-points.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { createMesmerSkillEffects, mesmerShatterDefinition } from '#gw2/professions/mesmer/family-mechanics.js';
import { createMesmerIllusionRewards, mesmerActivePrimaryWeapon } from '#gw2/professions/mesmer/family-resources.js';
import { mesmerResourceDefinition } from '#gw2/professions/mesmer/family-state.js';
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
      impactDelayMs: cast.command.impactDelayMs,
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

/** Complete ordinary resource grants and healing reactions, then retire shared cast bookkeeping. */
export function completeMesmerCast(context: MesmerRuntime, cast: RuntimeCast<MesmerSkill>, skill: MesmerSkill): void {
  const details = context.profession.core.castDetails.get(cast.id) || {};
  const at = context.time;
  const interrupted = castWasInterrupted(cast);

  if (interrupted && details.earlyResourceAt != null && canonicalTime(cast.effectiveEnd) < details.earlyResourceAt) {
    context.cancelOwner({ id: details.earlyResourceOwnerId!, generation: 0 });
  }

  const completedInterruptedPhantasm = isCommittedInterruptedPhantasm(cast, skill);
  const delivery = mesmerCastDelivery(
    cast,
    skill,
    interrupted && !completedInterruptedPhantasm ? cast.effectiveEnd : Infinity
  );
  try {
    // Cancelled attempts clear cast-local state without granting completion effects.
    if (cast.cancelledBeforeCommit) return;

    if (skill.id === SHARED_SKILL_IDS.SWAP_WEAPONS) return;

    // Ordinary grants need only the reward queue; resource-free casts must not construct effect controllers.
    if (
      (skill.resource?.mode === 'add' || skill.resource?.mode === 'fill') &&
      !mesmerShatterDefinition(context, skill.id) &&
      !skill.phantasm &&
      !skill.ambush &&
      !skill.instrument &&
      !details.resourceScheduledDuringCast
    ) {
      scheduleDirectSkillResources(
        {
          resourceDefinition: mesmerResourceDefinition(context.profession.specialization.kind, context.helpers),
          activePrimaryWeapon: () => mesmerActivePrimaryWeapon(context),
          queueResources: createMesmerIllusionRewards(context).queueResources
        },
        skill,
        skill.resource.timingAnchor === 'castEnd' ? cast.fullEnd : at,
        cast.start,
        delivery
      );
    }

    context.fireTrigger(mesmerHealCompleted, { skill, at, delivery });
  } finally {
    context.profession.core.castDetails.delete(cast.id);
  }
}

/** Schedule ordinary cast-start resource grants and retain their ownership until completion. */
export function startMesmerCast(context: MesmerRuntime, cast: RuntimeCast<MesmerSkill>, skill: MesmerSkill): void {
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

  context.profession.core.castDetails.set(cast.id, {
    earlyResourceAt,
    earlyResourceOwnerId,
    resourceScheduledDuringCast
  });
}
