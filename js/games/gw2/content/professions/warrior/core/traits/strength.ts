/** Owns imperative Strength trait effects while the public dispatcher preserves cross-line ordering. */
import { balanceProfileFromContext, balanceProfileEffect } from '#gw2/platform/combat/state/balance-profiles.js';
import { emitSkillBuff, emitSkillCondition, emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { castRelativeEffectTimingScale } from '#gw2/platform/skills/timing.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/scheduler/policy.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/content/professions/warrior/data/ids.js';
import { gainWarriorEndurance } from '#gw2/content/professions/warrior/core/mechanics/adrenaline-and-endurance.js';
import { gainWarriorAdrenaline } from '#gw2/content/professions/warrior/resources.js';
import { WARRIOR_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/warrior/core/profiles.js';
import type {
  WarriorCastContext,
  WarriorResolverContext,
  WarriorResolverEvent,
  WarriorSchedulerContext,
  WarriorSimulationEvent,
  WarriorSkill
} from '#gw2/content/professions/warrior/types.js';

export const BRAVE_STRIDE_MOVEMENT_SKILL_IDS = Object.freeze([
  ID.SAVAGE_LEAP,
  ID.WHIRLWIND_ATTACK,
  ID.RUSH,
  ID.BRUTAL_SHOT,
  ID.VALIANT_LEAP,
  ID.LINE_BREAKER,
  ID.SPEAR_SWIPE,
  ID.AURA_SLICER,
  ID.GUNSTINGER,
  ID.DRAGONS_ROAR,
  ID.BULLS_CHARGE,
  ID.KICK,
  ID.STOMP,
  ID.EVISCERATE,
  ID.BREACHING_STRIKE,
  ID.EARTHSHAKER
]);
const MOVEMENT_SKILL_IDS = new Set<number>(BRAVE_STRIDE_MOVEMENT_SKILL_IDS);
const BODY_BLOW_CONTROL_KINDS = new Set(['stun', 'daze', 'knockback', 'pull', 'push', 'launch']);

export function reactToWarriorBuff(context: WarriorResolverContext, event: WarriorResolverEvent): void {
  if (Number(event.sourceId) !== TRAIT.PEAK_PERFORMANCE || event.kind !== 'peak-performance') return;
  context.recordProc('trait', 'Peak Performance', event.at, event.skillName, '+10% strike damage for 6 seconds');
}

// Convert a qualifying burst's adrenaline spend into the visible Berserker's Power stack tier.
function berserkersPowerStacks(context: WarriorCastContext, skill: WarriorSkill, spent: number): number {
  if (!skill.burst || spent <= 0 || !hasTrait(context, TRAIT.BERSERKERS_POWER)) return 0;
  const tiers = balanceProfileFromContext(context, PROFILE.burstTiers);
  const tierTwo = Number(tiers?.threshold || 20);
  const tierThree = Number(tiers?.maximumStacks || 30);
  return spent >= tierThree ? 4 : spent >= tierTwo ? 3 : 2;
}

export function grantBerserkersPowerOnFirstHit(
  context: WarriorCastContext,
  skill: WarriorSkill,
  event: WarriorSimulationEvent,
  spent: number
): boolean {
  if (event.type !== 'damage' || !(Number(event.coefficient) > 0)) return false;
  const stacks = berserkersPowerStacks(context, skill, spent);
  if (stacks <= 0) return false;
  grantBerserkersPower(context, stacks, event.at + context.epsilon, skill);
  return true;
}

// Materialize Reckless Dodge's strike and Might together at dodge completion.
export function applyRecklessDodge(context: WarriorCastContext, skill: WarriorSkill): void {
  if (!hasTrait(context, TRAIT.RECKLESS_DODGE)) return;
  const profile = balanceProfileFromContext(context, PROFILE.recklessDodge);
  const strike = balanceProfileEffect(profile, 'strike');
  const might = balanceProfileEffect(profile, 'boon');
  emitSkillDamage(context, {
    at: context.effectiveEnd,
    source: 'Warrior',
    sourceId: TRAIT.RECKLESS_DODGE,
    actorType: 'player',
    skillId: skill.id,
    skillName: skill.name,
    name: 'Reckless Dodge',
    coefficient: Number(strike?.coefficient || 1.5)
  });
  emitSkillBuff(context, {
    at: context.effectiveEnd,
    source: 'Trait',
    sourceId: TRAIT.RECKLESS_DODGE,
    actorType: 'effect',
    skillId: skill.id,
    skillName: skill.name,
    name: 'Reckless Dodge — Might',
    kind: 'might',
    boon: 'might',
    stacks: Number(might?.stacks || 2),
    duration: gw2SchedulerBoonDuration(context, skill, 'might', Number(might?.duration || 5))
  });
}

export function grantBerserkersPower(
  context: WarriorCastContext,
  requestedStacks: number,
  at: number,
  skill: WarriorSkill
): void {
  if (!hasTrait(context, TRAIT.BERSERKERS_POWER)) return;
  const state = professionCoreState(context);
  const granted = Math.max(0, requestedStacks);
  if (!granted) return;
  const effect = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.berserkersPower), 'buff');
  const duration = Number(effect?.duration || 15);
  // Keep overflow applications queued so older visible stacks can expire independently.
  state.burstPowerExpiries.push(...Array(granted).fill(at + duration));
  emitSkillBuff(context, {
    at,
    source: 'Trait',
    sourceId: TRAIT.BERSERKERS_POWER,
    actorType: 'effect',
    skillId: skill.id,
    skillName: skill.name,
    name: "Berserker's Power",
    kind: 'berserkers-power',
    stacks: granted,
    duration
  });
}

// Apply Peak Performance at cast start so Kick retains its packet-relative timing.
export function applyPeakPerformanceCastStart(context: WarriorCastContext, skill: WarriorSkill): void {
  if (!skill.categories?.includes('Physical') || !hasTrait(context, TRAIT.PEAK_PERFORMANCE)) return;
  const effect = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.peakPerformance), 'buff');
  let at = context.effectiveEnd;
  if (skill.id === ID.KICK) {
    const strike = skill.effects?.find((effect) => effect.type === 'strike');
    const authoredOffsetMs = Number(strike?.ticks?.[0]?.atMs ?? strike?.atMs ?? skill.castTimeMs ?? 0);
    const runtimeCastMs = Math.max(0, context.fullEnd - context.start) * 1000;
    const offsetMs =
      strike?.timingScale === 'cast'
        ? authoredOffsetMs * castRelativeEffectTimingScale(skill, runtimeCastMs)
        : authoredOffsetMs;
    at = Math.min(context.effectiveEnd, context.start + offsetMs / 1000);
  }

  emitSkillBuff(context, {
    at,
    source: 'Trait',
    sourceId: TRAIT.PEAK_PERFORMANCE,
    actorType: 'effect',
    skillId: skill.id,
    skillName: skill.name,
    name: 'Peak Performance',
    kind: 'peak-performance',
    stacks: Number(effect?.stacks || 1),
    duration: Number(effect?.duration || 6)
  });
}

// Apply Brave Stride after earlier cast-completion effects have materialized.
export function applyBraveStrideCastComplete(context: WarriorCastContext, skill: WarriorSkill): void {
  if (!(skill.movementSkill || MOVEMENT_SKILL_IDS.has(Number(skill.id))) || !hasTrait(context, TRAIT.BRAVE_STRIDE)) {
    return;
  }

  const profile = balanceProfileFromContext(context, PROFILE.braveStride);
  const stability = balanceProfileEffect(profile, 'boon');
  gainWarriorAdrenaline(context, Number(profile?.resourceGain || 5));
  emitSkillBuff(context, {
    at: context.effectiveEnd,
    source: 'Trait',
    sourceId: TRAIT.BRAVE_STRIDE,
    actorType: 'effect',
    skillId: skill.id,
    skillName: skill.name,
    name: 'Brave Stride',
    kind: 'stability',
    boon: 'stability',
    stacks: Number(stability?.stacks || 1),
    duration: gw2SchedulerBoonDuration(context, skill, 'stability', Number(stability?.duration || 5))
  });
}

// Materialize Body Blow conditions only for player hard-control events.
export function applyBodyBlow(context: WarriorSchedulerContext, event: WarriorSimulationEvent): void {
  if (
    event.type !== 'control' ||
    event.actorType !== 'player' ||
    !hasTrait(context, TRAIT.BODY_BLOW) ||
    !BODY_BLOW_CONTROL_KINDS.has(String(event.controlKind || '').toLowerCase())
  ) {
    return;
  }

  const profile = balanceProfileFromContext(context, PROFILE.bodyBlow);
  for (const [condition, duration, stacks] of (profile?.effects || [])
    .filter((effect) => effect.type === 'condition')
    .map(
      (effect) => [String(effect.condition || ''), Number(effect.duration || 0), Number(effect.stacks || 1)] as const
    )) {
    emitSkillCondition(context, {
      cause: event,
      at: event.at,
      source: 'Trait',
      sourceId: TRAIT.BODY_BLOW,
      actorType: 'effect',
      skillId: event.skillId,
      skillName: event.skillName,
      name: `Body Blow — ${condition}`,
      condition,
      stacks,
      duration
    });
  }
}

// Grant Aggressive Onslaught after the control-triggered Defense reactions.
export function applyAggressiveOnslaught(context: WarriorSchedulerContext, event: WarriorSimulationEvent): void {
  if (event.type !== 'control' || event.actorType !== 'player' || !hasTrait(context, TRAIT.AGGRESSIVE_ONSLAUGHT)) {
    return;
  }

  const state = professionCoreState(context);
  if (!isInternalCooldownReady(event.at, Number(state.traitProcReadyAt.aggressiveOnslaught || 0))) return;
  const profile = balanceProfileFromContext(context, PROFILE.aggressiveOnslaught);
  const quickness = balanceProfileEffect(profile, 'boon');
  state.traitProcReadyAt.aggressiveOnslaught = event.at + Number(profile?.internalCooldown || 0.25);
  emitSkillBuff(context, {
    skill:
      context.catalog.skillsById.get(event.skillId ?? '') ||
      ({ id: TRAIT.AGGRESSIVE_ONSLAUGHT, name: 'Aggressive Onslaught' } as WarriorSkill),
    cause: event,
    at: event.at,
    source: 'Trait',
    sourceId: TRAIT.AGGRESSIVE_ONSLAUGHT,
    actorType: 'effect',
    skillId: event.skillId,
    skillName: event.skillName,
    name: 'Aggressive Onslaught',
    kind: 'quickness',
    boon: 'quickness',
    duration: Number(quickness?.duration || 3),
    stacks: Number(quickness?.stacks || 1),
    recipients: 'self'
  });
}

// Restore endurance at the first qualifying hit of a burst activation.
export function applyBuildingMomentum(context: WarriorSchedulerContext, event: WarriorSimulationEvent): void {
  if (!hasTrait(context, TRAIT.BUILDING_MOMENTUM)) return;
  gainWarriorEndurance(
    context,
    Number(balanceProfileFromContext(context, PROFILE.buildingMomentum)?.resourceGain || 15),
    event.at
  );
}
