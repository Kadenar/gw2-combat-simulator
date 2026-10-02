import { targetConditionCount } from '#gw2/platform/combat/query/runtime-query.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { effectFirstAtMs } from '#gw2/platform/engine/effects/authoring.js';
import { scaleCastBoundTiming } from '#gw2/platform/engine/effects/materializer.js';
import { effectNumber, requireBalanceProfileFromContext } from '#gw2/platform/engine/skills/balance-profiles.js';
import type { SkillEffect, SkillId } from '#gw2/platform/engine/skills/types.js';
import { queueResolverBoon } from '#gw2/platform/resolver/boons.js';
import { buildResolverCondition, buildResolverStrike } from '#gw2/platform/resolver/packets.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { necromancerActiveBoonCompanionIds } from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import type { NecromancerCoreState, NecromancerSelfCondition } from '#gw2/professions/necromancer/core/state.js';
import type { NecromancerRuntime, NecromancerSkill } from '#gw2/professions/necromancer/types.js';
import { canonicalTime, isTimeInWindow } from '#kernel/core/clock.js';

const CORRUPTION = 'necromancer.corruption';
const DEVOURING = 'necromancer.devouring-impact';
const EXPIRY = 'necromancer.self-condition-expiry';
interface ConditionWork {
  skillId: SkillId;
  activationId?: string;
  offTarget?: boolean;
}

function purge(runtime: NecromancerRuntime): void {
  runtime.profession.core.selfConditions = runtime.profession.core.selfConditions.filter((application) =>
    isTimeInWindow(runtime.time, application.appliedAt, application.expiresAt)
  );
}

/** Self-inflicted durations use actual trait/relic state while excluding Expertise, without constructing another query world. */
function applySelfCondition(
  runtime: NecromancerRuntime,
  skill: NecromancerSkill,
  condition: string,
  stacks: number,
  duration: number
): void {
  const event = {
    type: 'self_condition' as const,
    at: runtime.time,
    source: 'necromancer',
    sourceId: skill.id,
    actorType: 'player' as const,
    skillId: skill.id,
    skillName: skill.name,
    condition,
    stacks
  };
  const stats = { ...runtime.query.statsAt(runtime.time, event, runtime), expertise: 0 };
  const effectiveDuration =
    duration * runtime.query.conditionDurationMultiplier(condition, runtime.time, stats, event, runtime);
  if (!(effectiveDuration > 0) || !(stacks > 0)) return;
  purge(runtime);
  const expiresAt = canonicalTime(runtime.time + effectiveDuration);
  runtime.profession.core.selfConditions.push({
    condition,
    stacks,
    appliedAt: runtime.time,
    expiresAt
  });
  runtime.emit({ ...event, name: `${skill.name} — self ${condition}`, duration: effectiveDuration, expiresAt });
  runtime.schedule(EXPIRY, expiresAt, null, undefined, -20);
}

/** A transfer removes actual applications and preserves their remaining duration, without scaling them a second time. */
export function transfer(
  runtime: NecromancerRuntime,
  skill: NecromancerSkill,
  maximum: number,
  work: ConditionWork,
  latest = false
): number {
  if (
    !(maximum > 0) ||
    work.offTarget ||
    runtime.deathTime != null ||
    runtime.combatStartPending ||
    (runtime.combatStartTime != null && runtime.time < runtime.combatStartTime)
  )
    return 0;
  purge(runtime);
  const state = runtime.profession.core;
  const types = new Set<string>();
  if (!latest)
    for (const application of state.selfConditions) {
      if (types.size >= maximum) break;
      types.add(application.condition);
    }

  const selected = latest
    ? state.selfConditions.slice(-maximum)
    : state.selfConditions.filter((application) => types.has(application.condition));
  state.selfConditions = state.selfConditions.filter((application) => !selected.includes(application));
  for (const application of selected)
    runtime.emit(
      buildResolverCondition({
        at: runtime.time,
        source: 'necromancer',
        sourceId: skill.id,
        actorType: 'player',
        skillId: skill.id,
        skillName: skill.name,
        activationId: work.activationId,
        name: `${skill.name} — Transferred ${application.condition}`,
        condition: application.condition,
        stacks: application.stacks,
        duration: application.expiresAt - runtime.time,
        fixedDuration: true
      })
    );
  return selected.length;
}

/** Corruption self-conditions and boons share completion timing, independently of hostile skill packets. */
export function isCorruptionCompletionEffect(effect: SkillEffect): boolean {
  return (effect.type === 'condition' && effect.target === 'self') || effect.type === 'boon';
}

function corruption(runtime: NecromancerRuntime, data: unknown): void {
  const work = data as ConditionWork;
  const skill = runtime.helpers.skillsById.get(work.skillId)!;
  for (const effect of skill.effects?.filter(isCorruptionCompletionEffect) ?? []) {
    if (effect.requiredTrait != null && !hasTrait(runtime, Number(effect.requiredTrait))) continue;
    if (effect.type === 'condition')
      applySelfCondition(
        runtime,
        skill,
        String(effect.condition),
        effectNumber(skill, effect, 'stacks'),
        effectNumber(skill, effect, 'duration')
      );
    else if (effect.type === 'boon') {
      const event = {
        type: 'buff' as const,
        at: runtime.time,
        source: 'necromancer',
        sourceId: skill.id,
        actorType: 'player' as const,
        skillId: skill.id,
        skillName: skill.name,
        activationId: work.activationId,
        kind: String(effect.boon),
        duration: effectNumber(skill, effect, 'duration'),
        stacks: effectNumber(skill, effect, 'stacks'),
        audience:
          effect.audience?.recipients === 'party'
            ? { ...effect.audience, eligibleCompanionIds: necromancerActiveBoonCompanionIds(runtime) }
            : effect.audience
      };
      queueResolverBoon(runtime, event, event);
    }
  }
}

/** Selected first-hit profiles retain self-condition storage and derived enemy applications. */
export function resolveNecromancerSkillConditions(
  runtime: NecromancerRuntime,
  event: Gw2ResolverEvent,
  profileId: SkillId
): void {
  const skill = runtime.helpers.skillsById.get(event.skillId!)!;
  const profile = requireBalanceProfileFromContext(runtime, profileId);
  for (const effect of profile.effects ?? []) {
    if (effect.type !== 'condition') continue;
    const condition = String(effect.condition);
    const stacks = effectNumber(profile, effect, 'stacks');
    const duration = effectNumber(profile, effect, 'duration');
    if (effect.target === 'self') applySelfCondition(runtime, skill, condition, stacks, duration);
    else
      runtime.emitDerived(
        event,
        buildResolverCondition({
          at: runtime.time,
          source: 'necromancer',
          sourceId: skill.id,
          actorType: 'player',
          skillId: skill.id,
          skillName: skill.name,
          condition,
          stacks,
          duration
        })
      );
  }
}

/** Transfers consume live applications before the shared Plague Sending consumer. */
export function resolveNecromancerTransfer(runtime: NecromancerRuntime, event: Gw2ResolverEvent): void {
  const skill = runtime.helpers.skillsById.get(event.skillId!)!;
  transfer(runtime, skill, Number(skill.conditionsTransferred), {
    skillId: skill.id,
    activationId: event.activationId
  });
}

/** A committed Corruption applies local work without hostile travel or the remaining animation tail. */
export function completeNecromancerCorruption(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>): void {
  corruption(runtime, { skillId: cast.skill.id, activationId: cast.id });
}

/** Blood Is Power applies local effects at launch, before its aftercast, without depending on target acceptance. */
export function scheduleBloodIsPowerLaunch(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>): void {
  const first = cast.skill.effects?.find((effect) => effect.type === 'strike');
  const timing = first && scaleCastBoundTiming(cast, cast.skill, first);
  const launchAt = timing?.type === 'strike' ? canonicalTime(cast.start + (effectFirstAtMs(timing) ?? 0) / 1000) : null;
  if (launchAt != null && launchAt <= cast.effectiveEnd)
    runtime.schedule(CORRUPTION, launchAt, { skillId: cast.skill.id, activationId: cast.id });
  // Removing the strike must not remove a successfully committed cast's independent self-conditions or boons.
  else if (!cast.cancelled)
    runtime.schedule(CORRUPTION, cast.effectiveEnd, { skillId: cast.skill.id, activationId: cast.id });
}

/** Plague Signet transfers immediately on commitment; it has no projectile or travel delay. */
export function resolvePlagueSignetTransfer(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>): void {
  transfer(runtime, cast.skill, Number(cast.skill.conditionsTransferred), {
    skillId: cast.skill.id,
    activationId: cast.id,
    offTarget: cast.command.offTarget
  });
}

/** Devouring Darkness samples live conditions at its precommit impact, independently of its selected strike. */
export function scheduleDevouringDarkness(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>): void {
  const impactAt = canonicalTime(cast.start + (cast.fullEnd - cast.start) * 0.8);
  if (impactAt <= cast.effectiveEnd)
    runtime.schedule(DEVOURING, impactAt + (cast.command.impactDelayMs ?? 0) / 1000, {
      skillId: cast.skill.id,
      activationId: cast.id,
      offTarget: cast.command.offTarget
    });
}

/** The impact reads conditions before emitting its own Torment; a removed strike leaves the condition packet independent. */
function devouring(runtime: NecromancerRuntime, data: unknown): void {
  const work = data as ConditionWork;
  const skill = runtime.helpers.skillsById.get(work.skillId)!;
  const count = Math.min(
    Number(skill.maximumConditions),
    targetConditionCount({ config: runtime.config, query: runtime.query, runtime, time: runtime.time })
  );
  const event = {
    at: runtime.time,
    source: 'necromancer',
    sourceId: skill.id,
    actorType: 'player' as const,
    skillId: skill.id,
    skillName: skill.name,
    activationId: work.activationId,
    offTarget: work.offTarget,
    metadata: { necromancerConditionCount: count }
  };
  const strike = skill.effects?.find((effect) => effect.type === 'strike');
  const torment = skill.effects?.find((effect) => effect.type === 'condition');
  const reactionGroup = strike && runtime.effectReactions.register(skill, strike);
  if (strike)
    runtime.emit(
      buildResolverStrike({
        ...event,
        ...(reactionGroup === undefined ? {} : { effectReaction: { group: reactionGroup, packet: 1 } }),
        coefficient: effectNumber(skill, strike, 'coefficient'),
        skillWeapon: skill.weapon
      })
    );
  if (torment && count > 0)
    runtime.emit(
      buildResolverCondition({
        ...event,
        condition: String(torment.condition),
        stacks: count * effectNumber(skill, torment, 'stacks'),
        duration: effectNumber(skill, torment, 'duration')
      })
    );
}

export const necromancerConditionTasks = {
  [CORRUPTION]: corruption,
  [DEVOURING]: devouring,
  [EXPIRY]: purge
};

/** Removes expired or not-yet-active self-condition applications and returns the remaining active set. */
function purgeNecromancerSelfConditions(state: NecromancerCoreState, at: number): NecromancerSelfCondition[] {
  state.selfConditions = state.selfConditions.filter((application) =>
    isTimeInWindow(at, application.appliedAt, application.expiresAt)
  );
  return state.selfConditions;
}

/** Removes up to the requested number of distinct active self-condition types. */
export function removeNecromancerSelfCondition(
  state: NecromancerCoreState,
  at: number,
  maximumConditionTypes = 1
): void {
  const active = purgeNecromancerSelfConditions(state, at);
  const selected = new Set<string>();
  for (const application of active) {
    if (selected.size >= maximumConditionTypes) break;
    selected.add(application.condition);
  }

  state.selfConditions = active.filter((application) => !selected.has(application.condition));
}
