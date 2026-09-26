import { canonicalTime, isTimeInWindow } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { targetConditionCount } from '#gw2/platform/combat/query/runtime-query.js';
import { effectFirstAtMs } from '#gw2/platform/engine/effects/authoring.js';
import { scaleCastBoundTiming } from '#gw2/platform/engine/effects/materializer.js';
import {
  effectNumber,
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { buildResolverCondition, buildResolverStrike } from '#gw2/platform/resolver/packets.js';
import { queueResolverBoon } from '#gw2/platform/resolver/boons.js';
import { necromancerActiveBoonCompanionIds } from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import { castCompleted } from '#gw2/platform/skills/timing.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import {
  NECROMANCER_CORE_BALANCE_PROFILE_IDS as PROFILE,
  NECROMANCER_CORRUPTION_PROFILE_IDS
} from '#gw2/professions/necromancer/core/profiles.js';
import type { NecromancerRuntime, NecromancerSkill } from '#gw2/professions/necromancer/types.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';

const CORRUPTION = 'necromancer.corruption';
const TRANSFER = 'necromancer.transfer';
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
    stacks,
    selfCondition: true
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
    expiresAt,
    sourceSkillId: skill.id,
    sourceSkillName: skill.name
  });
  runtime.emit({ ...event, name: `${skill.name} — self ${condition}`, duration: effectiveDuration, expiresAt });
  runtime.schedule(EXPIRY, expiresAt, null, undefined, -20);
}

/** A transfer removes actual applications and preserves their remaining duration, without scaling them a second time. */
function transfer(
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
        fixedDuration: true,
        transferredCondition: true,
        transferredFromSkillId: application.sourceSkillId
      })
    );
  return selected.length;
}

function corruption(runtime: NecromancerRuntime, data: unknown): void {
  const work = data as ConditionWork;
  const skill = runtime.helpers.skillsById.get(work.skillId) as NecromancerSkill;
  const profile = requireBalanceProfileFromContext(runtime, NECROMANCER_CORRUPTION_PROFILE_IDS[skill.id]);
  for (const effect of profile.effects ?? []) {
    if (effect.requiredTrait != null && !hasTrait(runtime, Number(effect.requiredTrait))) continue;
    if (effect.type === 'condition')
      applySelfCondition(
        runtime,
        skill,
        String(effect.condition),
        effectNumber(profile, effect, 'stacks'),
        effectNumber(profile, effect, 'duration')
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
        duration: effectNumber(profile, effect, 'duration'),
        stacks: effectNumber(profile, effect, 'stacks'),
        audience:
          effect.audience?.recipients === 'party'
            ? { ...effect.audience, eligibleCompanionIds: necromancerActiveBoonCompanionIds(runtime) }
            : effect.audience
      };
      queueResolverBoon(runtime, event, event);
    }
  }
}

/** First-hit effects and Plague Sending run only after an accepted player strike. */
export function reactToLiveNecromancerConditions(runtime: NecromancerRuntime, event: Gw2ResolverEvent): void {
  if (event.actorType !== 'player' || !(Number(event.coefficient) > 0)) return;
  const skill = runtime.helpers.skillsById.get(event.skillId ?? event.sourceId) as NecromancerSkill | undefined;
  if (!skill) return;
  const work = { skillId: skill.id, activationId: event.activationId };
  if (Number(event.hitIndex ?? 1) === 1) {
    const profileId =
      skill.id === ID.LIFE_SIPHON ? PROFILE.lifeSiphonOnHit : skill.id === ID.DARK_PACT ? PROFILE.darkPactOnHit : null;
    if (profileId) {
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

    if (Number(skill.conditionsTransferred) > 0) transfer(runtime, skill, Number(skill.conditionsTransferred), work);
  }

  const state = runtime.profession.core;
  if (
    state.plagueSendingArmed &&
    transfer(
      runtime,
      skill,
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.PLAGUE_SENDING), 'maximumConditions'),
      work,
      true
    )
  ) {
    state.plagueSendingArmed = false;
    state.plagueSendingEntrySkillId = null;
  }
}

/** Custom condition owners schedule only committed work; travel postpones the impact's live observation. */
export function scheduleNecromancerConditions(runtime: NecromancerRuntime, cast: RuntimeCast): void {
  const skill = cast.skill as NecromancerSkill;
  const work: ConditionWork = { skillId: skill.id, activationId: cast.id, offTarget: cast.command.offTarget };
  if (NECROMANCER_CORRUPTION_PROFILE_IDS[skill.id]) {
    const first = skill.effects?.find((effect) => effect.type === 'strike');
    const timing = first && scaleCastBoundTiming(cast, skill, first);
    const committedBloodIsPower =
      skill.id === ID.BLOOD_IS_POWER &&
      first &&
      timing?.type === 'strike' &&
      cast.start + Number(effectFirstAtMs(timing) ?? 0) / 1000 <= cast.effectiveEnd;
    if (castCompleted(cast) || committedBloodIsPower) runtime.schedule(CORRUPTION, cast.effectiveEnd, work);
  }

  // Only the signet transfers without a hit; removing Deathly Swarm's strike must not create a completion transfer.
  if (skill.id === ID.PLAGUE_SIGNET && castCompleted(cast))
    runtime.schedule(TRANSFER, cast.effectiveEnd + Number(cast.command.impactDelayMs ?? 0) / 1000, work);
  if (skill.id === ID.DEVOURING_DARKNESS) {
    const impactAt = canonicalTime(cast.start + (cast.fullEnd - cast.start) * 0.8);
    if (impactAt <= cast.effectiveEnd)
      runtime.schedule(DEVOURING, impactAt + Number(cast.command.impactDelayMs ?? 0) / 1000, work);
  }
}

/** The impact reads conditions before emitting its own Torment; a removed strike leaves the condition packet independent. */
function devouring(runtime: NecromancerRuntime, data: unknown): void {
  const work = data as ConditionWork;
  const skill = runtime.helpers.skillsById.get(work.skillId) as NecromancerSkill;
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
  if (strike)
    runtime.emit(
      buildResolverStrike({
        ...event,
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

export const liveConditionTasks = {
  [CORRUPTION]: corruption,
  [DEVOURING]: devouring,
  [EXPIRY]: purge,
  [TRANSFER](runtime: NecromancerRuntime, data: unknown) {
    const work = data as ConditionWork;
    const skill = runtime.helpers.skillsById.get(work.skillId) as NecromancerSkill;
    transfer(runtime, skill, Number(skill.conditionsTransferred), work);
  }
};
