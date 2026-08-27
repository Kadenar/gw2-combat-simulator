import { emitSkillBuff, emitSkillCondition, emitSkillDamage } from '../../../platform/gw2/scheduler/skill-events.js';
import { professionCoreState } from '../../../platform/engine/profession/state.js';
import { enqueueOrdered } from '../../../platform/engine/events/queue.js';
import { castRelativeEffectTimingScale } from '../../../platform/gw2/skills/timing.js';
/**
 * Warrior trait lifecycle, event observation, and resolver reactions.
 *
 * Seeds trait-owned proc state, applies cast-start/complete/after-cast trait
 * reactions, and materializes derived trait effects from scheduled damage,
 * condition, control, and buff events. Specialization trait reactions live in
 * their specialization slices.
 */
import type { ScheduledTask } from '../../../platform/engine/types.js';
import { hasTrait } from '../../../platform/gw2/combat/state/traits.js';
import { combinedTargetDamage } from '../../../platform/gw2/combat/state/target-health.js';
import { gw2ResolverBoonDuration } from '../../../platform/gw2/resolver/boon-duration.js';
import { advanceScheduledCriticalProc } from '../../../platform/gw2/scheduler/critical-facts.js';
import { gw2SchedulerBoonDuration } from '../../../platform/gw2/scheduler/policy.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '../data/ids.js';
import { gainWarriorEndurance } from './resources.js';
import { gainWarriorAdrenaline, warriorGainsAdrenalineOnHit } from '../resources.js';
import {
  warriorBalanceProfile,
  warriorBalanceProfileEffect,
  WARRIOR_CORE_BALANCE_PROFILE_IDS as PROFILE
} from './profiles.js';
import type {
  WarriorCastContext,
  WarriorResolverContext,
  WarriorResolverEvent,
  WarriorSchedulerContext,
  WarriorSimulationEvent,
  WarriorSkill
} from '../types.js';

// Trigger Lesser Signet of Might on the first eligible post-half-health strike,
// reserving its ICD before queuing the delayed boon package.
export function reactToWarriorDamage(context: WarriorResolverContext, event: WarriorResolverEvent): void {
  const targetHealth = Number(context.config.target?.health || 0);
  const damageDone = combinedTargetDamage(context);
  const state = professionCoreState(context);
  if (
    event.actorType !== 'player' ||
    !(Number(event.coefficient || 0) > 0) ||
    !(targetHealth > 0) ||
    damageDone < targetHealth * 0.5 ||
    !hasTrait(context, TRAIT.SIGNET_MASTERY) ||
    event.at < Number(state.traitProcReadyAt.lesserSignetMight || 0)
  ) {
    return;
  }

  const signetMastery = warriorBalanceProfile(context, PROFILE.signetMastery);
  state.traitProcReadyAt.lesserSignetMight = event.at + Number(signetMastery?.internalCooldown || 20);
  for (const effect of signetMastery?.effects || []) {
    const kind = String(effect.boon || effect.kind || '');
    enqueueOrdered(context.queue, {
      type: 'buff',
      at: event.at + 1e-9,
      priority: -5,
      source: 'Trait',
      sourceId: TRAIT.SIGNET_MASTERY,
      actorType: 'effect',
      skillId: TRAIT.SIGNET_MASTERY,
      skillName: 'Lesser Signet of Might',
      name: 'Lesser Signet of Might',
      kind,
      stacks: Number(effect.stacks || 1),
      duration: gw2ResolverBoonDuration(context, event, kind, Number(effect.duration || 0))
    });
  }

  context.recordProc(
    'trait',
    'Lesser Signet of Might',
    event.at,
    event.skillName,
    '10 might; Signet Mastery stack',
    String(context.helpers.skillsById?.get(ID.SIGNET_OF_MIGHT)?.icon || '')
  );
}

export function reactToWarriorBuff(context: WarriorResolverContext, event: WarriorResolverEvent): void {
  if (Number(event.sourceId) !== TRAIT.PEAK_PERFORMANCE || event.kind !== 'peak-performance') {
    return;
  }

  context.recordProc('trait', 'Peak Performance', event.at, event.skillName, '+10% strike damage for 6 seconds');
}

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

// Snapshot Burst Precision's duration by activation from the adrenaline tier so
// the first delayed hit can consume the correct value.
export function armBurstPrecision(context: WarriorCastContext, skill: WarriorSkill, spent: number): void {
  if (!skill.burst || spent <= 0 || !hasTrait(context, TRAIT.BURST_PRECISION)) {
    return;
  }

  const profile = warriorBalanceProfile(context, PROFILE.burstPrecision);
  professionCoreState(context).burstPrecisionDurations[context.reservationId] =
    spent >= 30 ? Number(profile?.maximumStacks || 4) : Number(profile?.minimumStacks || 2);
}

// Apply traits owned by the burst resource spend, including Burst Precision,
// adrenaline refund, and the post-cast Swiftness packet.
export function applyWarriorBurstSpendTraits(
  context: WarriorCastContext,
  skill: WarriorSkill,
  adrenalineSpent: number,
  options: {
    readonly resourceSpent?: number;
    readonly resourceRefundRate?: number;
  } = {}
): void {
  armBurstPrecision(context, skill, adrenalineSpent);
  if (!skill.burst || adrenalineSpent <= 0 || !hasTrait(context, TRAIT.BURST_MASTERY)) {
    return;
  }

  const profile = warriorBalanceProfile(context, PROFILE.burstMastery);
  const swiftness = warriorBalanceProfileEffect(profile, 'boon');
  const resourceSpent = Number(options.resourceSpent ?? adrenalineSpent);
  const resourceRefundRate = Number(options.resourceRefundRate ?? profile?.resourceGain ?? 0.33);
  gainWarriorAdrenaline(context, Math.max(0, resourceSpent) * resourceRefundRate);
  emitSkillBuff(context, {
    at: context.effectiveEnd + context.epsilon,
    source: 'Trait',
    sourceId: TRAIT.BURST_MASTERY,
    actorType: 'effect',
    skillId: skill.id,
    skillName: skill.name,
    name: 'Burst Mastery — Swiftness',
    kind: 'swiftness',
    boon: 'swiftness',
    stacks: Number(swiftness?.stacks || 1),
    duration: gw2SchedulerBoonDuration(context, skill, 'swiftness', Number(swiftness?.duration || 3))
  });
}

// Convert a qualifying burst's adrenaline spend into the visible Berserker's
// Power stack tier.
function berserkersPowerStacks(context: WarriorCastContext, skill: WarriorSkill, spent: number): number {
  if (!skill.burst || spent <= 0 || !hasTrait(context, TRAIT.BERSERKERS_POWER)) {
    return 0;
  }

  const tiers = warriorBalanceProfile(context, PROFILE.burstTiers);
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
  if (event.type !== 'damage' || !(Number(event.coefficient) > 0)) {
    return false;
  }

  const stacks = berserkersPowerStacks(context, skill, spent);
  if (stacks <= 0) return false;
  grantBerserkersPower(context, stacks, event.at + context.epsilon, skill);
  return true;
}

export function applyMartialCadenceWeaponSwap(context: WarriorCastContext, at: number): void {
  if (hasTrait(context, TRAIT.MARTIAL_CADENCE)) {
    professionCoreState(context).soldierFocusReadyAt = at;
  }
}

// Materialize Reckless Dodge's strike and Might together at dodge completion.
export function applyRecklessDodge(context: WarriorCastContext, skill: WarriorSkill): void {
  if (!hasTrait(context, TRAIT.RECKLESS_DODGE)) return;
  const profile = warriorBalanceProfile(context, PROFILE.recklessDodge);
  const strike = warriorBalanceProfileEffect(profile, 'strike');
  const might = warriorBalanceProfileEffect(profile, 'boon');
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
  const effect = warriorBalanceProfileEffect(warriorBalanceProfile(context, PROFILE.berserkersPower), 'buff');
  const duration = Number(effect?.duration || 15);
  // The UI caps Berserker's Power at four visible stacks, but additional
  // applications remain queued and surface as older applications expire.
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

// Restore ammo without erasing an active cast lockout or incorrectly exposing a
// skill whose zero-charge cooldown was mirroring count recharge.
function restoreAmmo(context: WarriorSchedulerContext, skill: WarriorSkill, count: number, at: number): number {
  const ammo = context.cooldownController.refreshAmmo(skill, at);
  if (!ammo) return 0;
  const missing = Math.max(0, ammo.maximum - ammo.charges);
  const restored = Math.min(missing, Math.max(0, count));
  if (!restored) return 0;

  const mirroredRecharge = ammo.nextRechargeAt;
  const readyAt = Number(context.state.cooldowns.get(skill.id) || 0);
  const lastAction = [...context.events]
    .reverse()
    .find((event) => event.type === 'action' && event.skillId === skill.id);
  const lastActionEnd = Number(lastAction?.endsAt || 0);
  const lockoutReadyAt =
    lastActionEnd +
    context.rechargeDurationFor(skill, lastActionEnd, {
      ammoCastLockout: true
    });
  if (ammo.charges === 0 && mirroredRecharge != null && readyAt <= mirroredRecharge + context.epsilon) {
    context.state.cooldowns.delete(skill.id);
  }

  ammo.charges += restored;
  if (ammo.charges >= ammo.maximum) ammo.nextRechargeAt = null;
  context.cooldownController.refreshAmmo(skill, at);
  if (lockoutReadyAt > at + context.epsilon) {
    context.state.cooldowns.set(skill.id, lockoutReadyAt);
  }

  return restored;
}

// Apply completion-owned Core traits: Signet Mastery state, shadowstep relic
// activation, and Brave Stride's adrenaline plus Stability.
export function completeWarriorSkill(context: WarriorCastContext, skill: WarriorSkill): void {
  const at = context.effectiveEnd;
  if (skill.categories?.includes('Signet') && hasTrait(context, TRAIT.SIGNET_MASTERY)) {
    const effect = warriorBalanceProfileEffect(warriorBalanceProfile(context, PROFILE.signetMastery), 'buff');
    emitSkillBuff(context, {
      at: at + context.epsilon,
      source: 'Trait',
      sourceId: TRAIT.SIGNET_MASTERY,
      actorType: 'effect',
      skillId: skill.id,
      skillName: skill.name,
      name: 'Signet Mastery',
      kind: 'signet-mastery',
      stacks: Number(effect?.stacks || 1),
      duration: Number(effect?.duration || 60)
    });
  }

  if (skill.shadowstepSkill && context.config.relic === 'Peitha') {
    context.emit({
      type: 'peitha',
      at,
      source: 'Warrior',
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      name: 'Relic of Peitha'
    });
  }

  if ((skill.movementSkill || MOVEMENT_SKILL_IDS.has(Number(skill.id))) && hasTrait(context, TRAIT.BRAVE_STRIDE)) {
    const profile = warriorBalanceProfile(context, PROFILE.braveStride);
    const stability = warriorBalanceProfileEffect(profile, 'boon');
    gainWarriorAdrenaline(context, Number(profile?.resourceGain || 5));
    emitSkillBuff(context, {
      at,
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
}

/** Runs Core Warrior mechanics owned by one completed skill activation. */
export const warriorCoreSkillMechanicHandlers = Object.freeze({
  'warrior.core.reset-crushing-blow': ({ context }: { context: WarriorSchedulerContext }): void => {
    context.state.cooldowns.delete(ID.CRUSHING_BLOW);
  },
  'warrior.core.reset-fierce-blow': ({ context }: { context: WarriorSchedulerContext }): void => {
    context.state.cooldowns.delete(ID.FIERCE_BLOW);
  },
  'warrior.core.restore-endurance': ({
    context,
    trigger,
    at
  }: {
    context: WarriorSchedulerContext;
    trigger: { readonly count?: number };
    at: number;
  }): void => {
    gainWarriorEndurance(context, trigger.count ?? 100, at);
  },
  'warrior.core.restore-dragons-roar-ammo': ({
    context,
    trigger,
    at
  }: {
    context: WarriorSchedulerContext;
    trigger: { readonly count?: number };
    at: number;
  }): void => {
    const skill = context.catalog.skillsById.get(ID.DRAGONS_ROAR) as WarriorSkill | undefined;
    if (skill) restoreAmmo(context, skill, trigger.count ?? 3, at);
  }
});

// Capture cast-start Warrior state for dodge, burst, signet, ammo, and trait
// mechanics before later effects can alter resources or cooldowns.
export function beginWarriorSkill(context: WarriorCastContext, skill: WarriorSkill): void {
  if (skill.type === 'Heal' && hasTrait(context, TRAIT.THICK_SKIN)) {
    emitSkillBuff(context, {
      at: context.start,
      source: 'Trait',
      sourceId: TRAIT.THICK_SKIN,
      actorType: 'effect',
      skillId: skill.id,
      skillName: skill.name,
      name: 'Thick Skin',
      kind: 'protection',
      boon: 'protection',
      stacks: 1,
      duration: gw2SchedulerBoonDuration(context, skill, 'protection', 3)
    });
  }

  if (!skill.categories?.includes('Physical') || !hasTrait(context, TRAIT.PEAK_PERFORMANCE)) {
    return;
  }

  const effect = warriorBalanceProfileEffect(warriorBalanceProfile(context, PROFILE.peakPerformance), 'buff');
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

// Return sampled critical hits or convert deterministic critical probability into
// an integer count while preserving fractional progress.
function armsCriticalCount(context: WarriorSchedulerContext, event: WarriorSimulationEvent): number {
  const hits = Math.max(1, Number(event.hits || 1));
  const state = professionCoreState(context);
  const tracker = { progress: state.armsCriticalProgress, readyAt: 0 };
  const application = advanceScheduledCriticalProc(context, event, { id: 'warrior.core.arms-critical' }, tracker, hits);
  state.armsCriticalProgress = tracker.progress;
  return application?.quantity || 0;
}

// Apply Bloodlust's per-critical proc chance in stochastic mode or accumulate its
// expected value independently in deterministic mode.
function bloodlustProcCount(context: WarriorSchedulerContext, event: WarriorSimulationEvent): number {
  const procChance = Number(warriorBalanceProfile(context, PROFILE.bloodlust)?.procChance || 0.33);
  const state = professionCoreState(context);
  const hits = Math.max(1, Number(event.hits || 1));
  const tracker = { progress: state.bloodlustProgress, readyAt: 0 };
  const application = advanceScheduledCriticalProc(
    context,
    event,
    {
      id: 'warrior.core.bloodlust',
      chanceOnCriticalHit: procChance,
      randomStream: 'warrior.bloodlust'
    },
    tracker,
    hits
  );
  state.bloodlustProgress = tracker.progress;
  return application?.quantity || 0;
}

// Materialize sampled or expected critical outcomes into Keen Strike, Bloodlust,
// Furious, and first-burst-hit Sundering Burst effects.
function applyArmsCriticalTraits(
  context: WarriorSchedulerContext,
  event: WarriorSimulationEvent,
  firstBurstHit: boolean
): void {
  const criticals = armsCriticalCount(context, event);
  if (criticals > 0 && event.skillId === ID.KEEN_STRIKE) {
    emitSkillBuff(context, {
      skill:
        context.catalog.skillsById.get(event.skillId ?? '') ||
        ({ id: ID.KEEN_STRIKE, name: 'Keen Strike — Critical Might' } as WarriorSkill),
      cause: event,
      at: event.at,
      source: 'Trait',
      sourceId: ID.KEEN_STRIKE,
      actorType: 'effect',
      skillId: event.skillId,
      skillName: event.skillName,
      name: 'Keen Strike — Critical Might',
      kind: 'might',
      boon: 'might',
      duration: 5,
      stacks: 1,
      recipients: 'self'
    });
  }

  const state = professionCoreState(context);
  if (hasTrait(context, TRAIT.BLOODLUST)) {
    const bleeding = bloodlustProcCount(context, event);
    if (bleeding > 0) {
      const effect = warriorBalanceProfileEffect(warriorBalanceProfile(context, PROFILE.bloodlust), 'condition');
      emitSkillCondition(context, {
        cause: event,

        at: event.at,
        source: 'Trait',
        sourceId: TRAIT.BLOODLUST,
        actorType: 'effect',
        skillId: event.skillId,
        skillName: event.skillName,
        name: 'Bloodlust — Bleeding',
        condition: 'Bleeding',
        stacks: bleeding * Number(effect?.stacks || 1),
        duration: Number(effect?.duration || 3)
      });
    }
  }

  if (hasTrait(context, TRAIT.FURIOUS) && criticals > 0) {
    const profile = warriorBalanceProfile(context, PROFILE.furious);
    const effect = warriorBalanceProfileEffect(profile, 'buff');
    const stacks = criticals * Number(effect?.stacks || 1);
    gainWarriorAdrenaline(context, criticals * Number(profile?.resourceGain || 1));
    emitSkillBuff(context, {
      cause: event,

      at: event.at,
      source: 'Trait',
      sourceId: TRAIT.FURIOUS,
      actorType: 'effect',
      skillId: event.skillId,
      skillName: event.skillName,
      name: 'Furious Surge',
      kind: 'furious-surge',
      stacks,
      duration: Number(effect?.duration || 10)
    });
  }

  if (
    firstBurstHit &&
    hasTrait(context, TRAIT.SUNDERING_BURST) &&
    event.at + context.epsilon >= Number(state.traitProcReadyAt.sunderingBurst || 0)
  ) {
    const profile = warriorBalanceProfile(context, PROFILE.sunderingBurst);
    const effect = warriorBalanceProfileEffect(profile, 'condition', criticals > 0 ? 1 : 0);
    state.traitProcReadyAt.sunderingBurst = event.at + Number(profile?.internalCooldown || 5);
    emitSkillCondition(context, {
      cause: event,

      at: event.at,
      source: 'Trait',
      sourceId: TRAIT.SUNDERING_BURST,
      actorType: 'effect',
      skillId: event.skillId,
      skillName: event.skillName,
      name: 'Sundering Burst — Vulnerability',
      condition: 'Vulnerability',
      stacks: Number(effect?.stacks || (criticals > 0 ? 10 : 5)),
      duration: Number(effect?.duration || 8)
    });
  }
}

export function initializeWarriorTraits(context: WarriorSchedulerContext): void {
  const weapons = [
    context.config.primaryWeapon,
    context.config.secondaryWeapon,
    context.config.weaponSet2Primary,
    context.config.weaponSet2Secondary
  ].map(String);
  if (
    weapons.includes('Dagger') ||
    hasTrait(context, TRAIT.BLOODLUST) ||
    hasTrait(context, TRAIT.FURIOUS) ||
    hasTrait(context, TRAIT.SUNDERING_BURST)
  ) {
    (
      context.schedulerPolicy as unknown as {
        requireCriticalFacts?: () => void;
      }
    ).requireCriticalFacts?.();
  }
}

export function handleWarriorArmsCriticalTask(context: WarriorSchedulerContext, task: ScheduledTask): void {
  const payload = task.payload as {
    readonly eventOrder?: number;
    readonly firstBurstHit?: boolean;
  } | null;
  const event = context.eventByOrder(Number(payload?.eventOrder)) as WarriorSimulationEvent | undefined;
  if (!event) return;
  applyArmsCriticalTraits(context, event, Boolean(payload?.firstBurstHit));
}

// Route the canonical event stream through Core control, condition, boon, burst,
// critical, and on-hit adrenaline reactions while suppressing duplicate burst hits.
export function observeWarriorEvent(context: WarriorSchedulerContext, event: WarriorSimulationEvent): void {
  const state = professionCoreState(context);
  if (event.type === 'combat_start') {
    state.signetOfRageNextAt = event.at + 3;
  }

  const opportunistTrigger =
    (event.type === 'control' && event.actorType === 'player') ||
    (event.type === 'condition' && event.actorType === 'player' && event.condition === 'Immobilized');
  if (
    opportunistTrigger &&
    hasTrait(context, TRAIT.OPPORTUNIST) &&
    event.at + context.epsilon >= Number(state.traitProcReadyAt.opportunist || 0)
  ) {
    const profile = warriorBalanceProfile(context, PROFILE.opportunist);
    const fury = warriorBalanceProfileEffect(profile, 'boon');
    state.traitProcReadyAt.opportunist = event.at + Number(profile?.internalCooldown || 1);
    gainWarriorAdrenaline(context, Number(profile?.resourceGain || 5));
    emitSkillBuff(context, {
      skill:
        context.catalog.skillsById.get(event.skillId ?? '') ||
        ({ id: TRAIT.OPPORTUNIST, name: 'Opportunist' } as WarriorSkill),
      cause: event,
      at: event.at,
      source: 'Trait',
      sourceId: TRAIT.OPPORTUNIST,
      actorType: 'effect',
      skillId: event.skillId,
      skillName: event.skillName,
      name: 'Opportunist',
      kind: 'fury',
      boon: 'fury',
      duration: Number(fury?.duration || 3),
      stacks: Number(fury?.stacks || 1),
      recipients: 'self'
    });
  }

  if (event.type === 'control' && event.actorType === 'player') {
    state.targetControlledUntil = Math.max(state.targetControlledUntil, event.at + Number(event.duration || 1));
    if (hasTrait(context, TRAIT.MERCILESS_HAMMER)) {
      gainWarriorAdrenaline(
        context,
        Number(warriorBalanceProfile(context, PROFILE.mercilessHammer)?.resourceGain || 7)
      );
    }

    if (
      hasTrait(context, TRAIT.STALWART_STRENGTH) &&
      event.at + context.epsilon >= Number(state.traitProcReadyAt.stalwartStrength || 0)
    ) {
      const profile = warriorBalanceProfile(context, PROFILE.stalwartStrength);
      const stability = warriorBalanceProfileEffect(profile, 'boon');
      state.traitProcReadyAt.stalwartStrength = event.at + Number(profile?.internalCooldown || 0.25);
      emitSkillBuff(context, {
        skill:
          context.catalog.skillsById.get(event.skillId ?? '') ||
          ({ id: TRAIT.STALWART_STRENGTH, name: 'Stalwart Strength' } as WarriorSkill),
        cause: event,
        at: event.at,
        source: 'Trait',
        sourceId: TRAIT.STALWART_STRENGTH,
        actorType: 'effect',
        skillId: event.skillId,
        skillName: event.skillName,
        name: 'Stalwart Strength',
        kind: 'stability',
        boon: 'stability',
        duration: Number(stability?.duration || 5),
        stacks: Number(stability?.stacks || 1),
        recipients: 'self'
      });
    }

    if (
      hasTrait(context, TRAIT.BODY_BLOW) &&
      BODY_BLOW_CONTROL_KINDS.has(String(event.controlKind || '').toLowerCase())
    ) {
      const profile = warriorBalanceProfile(context, PROFILE.bodyBlow);
      for (const [condition, duration, stacks] of (profile?.effects || [])
        .filter((effect) => effect.type === 'condition')
        .map(
          (effect) =>
            [String(effect.condition || ''), Number(effect.duration || 0), Number(effect.stacks || 1)] as const
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

    if (hasTrait(context, TRAIT.AGGRESSIVE_ONSLAUGHT)) {
      const readyAt = Number(state.traitProcReadyAt.aggressiveOnslaught || 0);
      if (event.at + context.epsilon >= readyAt) {
        const profile = warriorBalanceProfile(context, PROFILE.aggressiveOnslaught);
        const quickness = warriorBalanceProfileEffect(profile, 'boon');
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
    }
  }

  if (event.type === 'condition' && event.condition === 'Crippled' && hasTrait(context, TRAIT.LEG_SPECIALIST)) {
    const effect = warriorBalanceProfileEffect(warriorBalanceProfile(context, PROFILE.legSpecialist), 'condition');
    emitSkillCondition(context, {
      cause: event,

      at: event.at,
      source: 'Trait',
      sourceId: TRAIT.LEG_SPECIALIST,
      actorType: 'effect',
      skillId: event.skillId,
      skillName: event.skillName,
      name: 'Leg Specialist — Immobilized',
      condition: 'Immobilized',
      stacks: Number(effect?.stacks || 1),
      duration: Number(effect?.duration || 1)
    });
  }

  if (
    event.type === 'buff' &&
    event.kind === 'might' &&
    event.affectsSelf !== false &&
    event.sourceId !== TRAIT.PHALANX_STRENGTH &&
    hasTrait(context, TRAIT.PHALANX_STRENGTH)
  ) {
    emitSkillBuff(context, {
      skill:
        context.catalog.skillsById.get(event.skillId ?? '') ||
        ({ id: TRAIT.PHALANX_STRENGTH, name: 'Phalanx Strength' } as WarriorSkill),
      cause: event,
      at: event.at,
      source: 'Trait',
      sourceId: TRAIT.PHALANX_STRENGTH,
      actorType: 'effect',
      skillId: event.skillId,
      skillName: event.skillName,
      name: 'Phalanx Strength',
      kind: 'might',
      boon: 'might',
      duration: 5,
      stacks: 1,
      recipients: 'allies',
      affectsSelf: false
    });
  }

  if (
    event.type === 'damage' &&
    (event.actorType === 'player' || event.canTriggerCriticalTraits === true) &&
    Number(event.coefficient) > 0
  ) {
    const skill = event.skillId == null ? undefined : context.catalog.skillsById.get(event.skillId);
    if (skill?.burst) {
      const activationKey = String(event.activationId || `${event.skillId}:${event.at}`);
      if (!state.burstHitActivations[activationKey]) {
        state.burstHitActivations[activationKey] = true;
        if (
          hasTrait(context, TRAIT.CULL_THE_WEAK) &&
          event.at + context.epsilon >= Number(state.traitProcReadyAt.cullTheWeak || 0)
        ) {
          state.traitProcReadyAt.cullTheWeak = event.at + 5;
          emitSkillCondition(context, {
            cause: event,

            at: event.at,
            source: 'Trait',
            sourceId: TRAIT.CULL_THE_WEAK,
            actorType: 'effect',
            skillId: event.skillId,
            skillName: event.skillName,
            name: 'Cull the Weak — Weakness',
            condition: 'Weakness',
            stacks: 1,
            duration: 3.5
          });
        }

        if (hasTrait(context, TRAIT.BURST_PRECISION)) {
          const duration = Number(
            state.burstPrecisionDurations[activationKey] || (Number(skill.burstTier || 1) >= 3 ? 4 : 2)
          );
          delete state.burstPrecisionDurations[activationKey];
          emitSkillBuff(context, {
            cause: event,

            at: event.at,
            source: 'Trait',
            sourceId: TRAIT.BURST_PRECISION,
            actorType: 'effect',
            skillId: event.skillId,
            skillName: event.skillName,
            name: 'Burst Precision',
            kind: 'burst-precision',
            stacks: 1,
            duration
          });
        }

        if (hasTrait(context, TRAIT.BUILDING_MOMENTUM)) {
          gainWarriorEndurance(
            context,
            Number(warriorBalanceProfile(context, PROFILE.buildingMomentum)?.resourceGain || 15),
            event.at
          );
        }

        if (hasTrait(context, TRAIT.MARCHING_ORDERS) && event.at + context.epsilon >= state.soldierFocusReadyAt) {
          const marchingOrders = warriorBalanceProfile(context, PROFILE.marchingOrders);
          const might = warriorBalanceProfileEffect(marchingOrders, 'boon');
          state.soldierFocusReadyAt = event.at + Number(marchingOrders?.internalCooldown || 10);
          emitSkillBuff(context, {
            skill:
              context.catalog.skillsById.get(event.skillId ?? '') ||
              ({ id: TRAIT.MARCHING_ORDERS, name: "Soldier's Focus — Might" } as WarriorSkill),
            cause: event,
            at: event.at,
            source: 'Trait',
            sourceId: TRAIT.MARCHING_ORDERS,
            actorType: 'effect',
            skillId: event.skillId,
            skillName: event.skillName,
            name: "Soldier's Focus — Might",
            kind: 'might',
            boon: 'might',
            duration: Number(might?.duration || 15),
            stacks: Number(might?.stacks || 3),
            recipients: 'party'
          });
          if (hasTrait(context, TRAIT.SOLDIERS_COMFORT)) {
            const protection = warriorBalanceProfileEffect(
              warriorBalanceProfile(context, PROFILE.soldiersComfort),
              'boon'
            );
            emitSkillBuff(context, {
              skill:
                context.catalog.skillsById.get(event.skillId ?? '') ||
                ({ id: TRAIT.SOLDIERS_COMFORT, name: "Soldier's Comfort" } as WarriorSkill),
              cause: event,
              at: event.at,
              source: 'Trait',
              sourceId: TRAIT.SOLDIERS_COMFORT,
              actorType: 'effect',
              skillId: event.skillId,
              skillName: event.skillName,
              name: "Soldier's Comfort",
              kind: 'protection',
              boon: 'protection',
              duration: Number(protection?.duration || 4),
              stacks: Number(protection?.stacks || 1),
              recipients: 'party'
            });
          }

          if (hasTrait(context, TRAIT.MARTIAL_CADENCE)) {
            const stability = warriorBalanceProfileEffect(
              warriorBalanceProfile(context, PROFILE.martialCadence),
              'boon'
            );
            emitSkillBuff(context, {
              skill:
                context.catalog.skillsById.get(event.skillId ?? '') ||
                ({ id: TRAIT.MARTIAL_CADENCE, name: 'Martial Cadence' } as WarriorSkill),
              cause: event,
              at: event.at,
              source: 'Trait',
              sourceId: TRAIT.MARTIAL_CADENCE,
              actorType: 'effect',
              skillId: event.skillId,
              skillName: event.skillName,
              name: 'Martial Cadence',
              kind: 'stability',
              boon: 'stability',
              duration: Number(stability?.duration || 3),
              stacks: Number(stability?.stacks || 1),
              recipients: 'party'
            });
          }
        }
      }
    }

    const armsActivationKey = String(event.activationId || `${event.skillId}:${event.at}`);
    const armsBurstKey = `arms:${armsActivationKey}`;
    const firstBurstHit = Boolean(skill?.burst) && !state.burstHitActivations[armsBurstKey];
    if (firstBurstHit) state.burstHitActivations[armsBurstKey] = true;
    const tracksArmsCritical =
      event.skillId === ID.KEEN_STRIKE ||
      hasTrait(context, TRAIT.BLOODLUST) ||
      hasTrait(context, TRAIT.FURIOUS) ||
      (firstBurstHit && hasTrait(context, TRAIT.SUNDERING_BURST));
    if (tracksArmsCritical) {
      context.tasks.schedule({
        type: 'warrior.arms-critical',
        at: Math.max(context.state.time, event.at),
        priority: -40,
        payload: {
          eventOrder: Number(event.__order),
          firstBurstHit
        }
      });
    }
  }

  if (
    !warriorGainsAdrenalineOnHit(context) ||
    event.type !== 'damage' ||
    (event.actorType !== 'player' && event.source !== 'Sigil') ||
    !(Number(event.coefficient) > 0)
  )
    return;
  context.tasks.schedule({
    type: 'warrior.adrenaline-hit',
    at: event.at,
    payload: { amount: Math.max(1, Number(event.hits || 1)) }
  });
}

// Catch periodic Signet of Rage adrenaline and Empower Allies pulses up to the
// scheduler target, respecting the signet's active cooldown window.
export function advanceWarriorTraits(context: WarriorSchedulerContext, target: number): void {
  const state = professionCoreState(context);
  const selectedSkills = context.config.selectedSkills || [];
  const selected = Array.isArray(selectedSkills) ? selectedSkills : Object.values(selectedSkills);
  if (selected.map(String).includes('Signet of Rage')) {
    while (state.signetOfRageNextAt > 0 && state.signetOfRageNextAt <= target + context.epsilon) {
      const at = state.signetOfRageNextAt;
      const cooldownReadyAt = Number(context.state.cooldowns.get(ID.SIGNET_OF_RAGE) || 0);
      if (cooldownReadyAt <= at + context.epsilon) gainWarriorAdrenaline(context, 2);
      state.signetOfRageNextAt += 3;
    }
  }

  if (!hasTrait(context, TRAIT.EMPOWER_ALLIES)) return;
  const empowerAllies = warriorBalanceProfile(context, PROFILE.empowerAllies);
  const might = warriorBalanceProfileEffect(empowerAllies, 'boon');
  const sourceSkill = { id: TRAIT.EMPOWER_ALLIES, name: 'Empower Allies' } as WarriorSkill;
  const interval = Number(empowerAllies?.pulseInterval || 10);
  while (state.empowerAlliesNextAt <= target + context.epsilon) {
    const at = state.empowerAlliesNextAt;
    emitSkillBuff(context, {
      at,
      source: 'Trait',
      sourceId: TRAIT.EMPOWER_ALLIES,
      actorType: 'effect',
      name: 'Empower Allies',
      kind: 'might',
      boon: 'might',
      stacks: Number(might?.stacks || 5),
      duration: gw2SchedulerBoonDuration(context, sourceSkill, 'might', Number(might?.duration || 10)),
      recipients: 'party'
    });
    state.empowerAlliesNextAt += interval;
  }
}

/** Applies every Core Warrior trait that extends the shared weapon swap. */
export function applyWarriorWeaponSwapTraits(context: WarriorCastContext, skill: WarriorSkill): void {
  const state = professionCoreState(context);
  applyMartialCadenceWeaponSwap(context, context.effectiveEnd);
  if (hasTrait(context, TRAIT.VERSATILE_RAGE)) {
    gainWarriorAdrenaline(context, 5);
  }

  if (
    hasTrait(context, TRAIT.FURIOUS_BURST) &&
    context.effectiveEnd + context.epsilon >= Number(state.traitProcReadyAt.furiousBurst || 0)
  ) {
    const profile = warriorBalanceProfile(context, PROFILE.furiousBurst);
    const fury = warriorBalanceProfileEffect(profile, 'boon');
    state.traitProcReadyAt.furiousBurst = context.effectiveEnd + Number(profile?.internalCooldown || 4);
    emitSkillBuff(context, {
      at: context.effectiveEnd,
      source: 'Trait',
      sourceId: TRAIT.FURIOUS_BURST,
      actorType: 'effect',
      skillId: skill.id,
      skillName: skill.name,
      name: 'Furious Burst',
      kind: 'fury',
      boon: 'fury',
      stacks: Number(fury?.stacks || 1),
      duration: gw2SchedulerBoonDuration(context, skill, 'fury', Number(fury?.duration || 2.5))
    });
  }
}
