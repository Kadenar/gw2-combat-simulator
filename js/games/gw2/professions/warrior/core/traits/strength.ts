import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';

/** Owns imperative Strength trait effects while the public dispatcher preserves cross-line ordering. */
import { tryConsumeProcCooldown } from '#gw2/platform/combat/procs.js';

import { emitSkillBuff, emitSkillCondition, emitSkillDamage } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { castRelativeEffectTimingScale } from '#gw2/platform/skills/timing.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/execution/gw2-policy/policy.js';
import { advanceScheduledCriticalProc } from '#gw2/platform/execution/gw2-policy/critical-facts.js';
import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { gainWarriorEndurance } from '#gw2/professions/warrior/core/mechanics/adrenaline-and-endurance.js';
import { gainWarriorAdrenaline } from '#gw2/professions/warrior/family-state.js';
import { WARRIOR_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/core/profiles.js';
import {
  warriorActiveBuffStacks,
  warriorWieldingWeapon,
  type WarriorModifierAttributes
} from '#gw2/professions/warrior/core/traits/modifier-queries.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type {
  WarriorCastContext,
  WarriorResolverContext,
  WarriorResolverEvent,
  WarriorSchedulerContext,
  WarriorSimulationEvent,
  WarriorSkill
} from '#gw2/professions/warrior/types.js';

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

// Keep Might's critical probability independent of Arms and double it for the wielded greatsword.
export function applyForcefulGreatsword(context: WarriorSchedulerContext, event: WarriorSimulationEvent): void {
  if (!hasTrait(context, TRAIT.FORCEFUL_GREATSWORD) || event.offTarget) return;

  const state = professionCoreState(context);
  const weapons = gw2ConfiguredWeaponSet(context.config, event.weaponSet ?? context.state.activeWeaponSet);
  const tracker = { progress: state.forcefulGreatswordProgress, readyAt: 0 };
  const forcefulGreatswordProfile = requireBalanceProfileFromContext(context, PROFILE.forcefulGreatsword);
  const application = advanceScheduledCriticalProc(
    context,
    event,
    {
      id: 'warrior.core.forceful-greatsword',
      chanceOnCriticalHit: Math.min(
        1,
        balanceProfileNumber(forcefulGreatswordProfile, 'procChance') * (weapons.includes('Greatsword') ? 2 : 1)
      ),
      randomStream: 'warrior.forceful-greatsword'
    },
    tracker,
    Math.max(1, Number(event.hits || 1))
  );
  state.forcefulGreatswordProgress = tracker.progress;
  if (!application) return;
  const might = requireEffect(forcefulGreatswordProfile, 'boon', 'might');
  if (might)
    emitSkillBuff(context, {
      cause: event,
      at: event.at,
      source: 'Trait',
      sourceId: TRAIT.FORCEFUL_GREATSWORD,
      actorType: 'effect',
      skillId: event.skillId,
      skillName: event.skillName,
      name: 'Forceful Greatsword — Might',
      fixedDuration: false,
      kind: 'might',
      boon: 'might',
      stacks: application.quantity * effectNumber(forcefulGreatswordProfile, might, 'stacks'),
      duration: effectNumber(forcefulGreatswordProfile, might, 'duration'),
      audience: { recipients: 'self' as const }
    });
}

export function reactToWarriorBuff(context: WarriorResolverContext, event: WarriorResolverEvent): void {
  if (Number(event.sourceId) !== TRAIT.PEAK_PERFORMANCE || event.kind !== 'peak-performance') return;
  context.recordProc('trait', 'Peak Performance', event.at, event.skillName, '+10% strike damage for 6 seconds');
}

// Convert a qualifying burst's adrenaline spend into the visible Berserker's Power stack tier.
function berserkersPowerStacks(context: WarriorCastContext, skill: WarriorSkill, spent: number): number {
  if (!skill.burst || spent <= 0 || !hasTrait(context, TRAIT.BERSERKERS_POWER)) return 0;

  const burstTiersProfile = requireBalanceProfileFromContext(context, PROFILE.burstTiers);
  const tierTwo = balanceProfileNumber(burstTiersProfile, 'threshold');
  const tierThree = balanceProfileNumber(burstTiersProfile, 'maximumStacks');
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
  grantBerserkersPower(context, stacks, event.at, skill);
  return true;
}

// Materialize Reckless Dodge's strike and Might together at dodge completion.
export function applyRecklessDodge(context: WarriorCastContext, skill: WarriorSkill): void {
  if (!hasTrait(context, TRAIT.RECKLESS_DODGE)) return;

  const recklessDodgeProfile = requireBalanceProfileFromContext(context, PROFILE.recklessDodge);
  const strike = requireEffect(recklessDodgeProfile, 'strike', 'Strike');
  const might = requireEffect(recklessDodgeProfile, 'boon', 'might');
  if (strike)
    emitSkillDamage(context, {
      at: context.effectiveEnd,
      source: 'Warrior',
      sourceId: TRAIT.RECKLESS_DODGE,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      name: 'Reckless Dodge',
      coefficient: effectNumber(recklessDodgeProfile, strike, 'coefficient')
    });
  if (might)
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
      stacks: effectNumber(recklessDodgeProfile, might, 'stacks'),
      duration: gw2SchedulerBoonDuration(context, skill, 'might', effectNumber(recklessDodgeProfile, might, 'duration'))
    });
}

export function grantBerserkersPower(
  context: WarriorCastContext,
  requestedStacks: number,
  at: number,
  skill: WarriorSkill
): void {
  if (!hasTrait(context, TRAIT.BERSERKERS_POWER)) return;
  const granted = Math.max(0, requestedStacks);
  if (!granted) return;
  const berserkersPowerProfile = requireBalanceProfileFromContext(context, PROFILE.berserkersPower);
  const effect = requireEffect(berserkersPowerProfile, 'buff', 'berserkers-power');
  // Removed packets do not open their associated state or schedule follow-ups.
  if (!effect) return;
  const duration = effectNumber(berserkersPowerProfile, effect, 'duration');
  // Buff applications own expiry and retain overflow beyond the visible stack cap.
  emitSkillBuff(context, {
    at,
    // The triggering burst packet resolves before its same-time reward.
    priority: 5,
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
  const peakPerformanceProfile = requireBalanceProfileFromContext(context, PROFILE.peakPerformance);
  const effect = requireEffect(peakPerformanceProfile, 'buff', 'peak-performance');
  // Removed packets do not open their associated state or schedule follow-ups.
  if (!effect) return;
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
    stacks: effectNumber(peakPerformanceProfile, effect, 'stacks'),
    duration: effectNumber(peakPerformanceProfile, effect, 'duration')
  });
}

// Apply Brave Stride after earlier cast-completion effects have materialized.
export function applyBraveStrideCastComplete(context: WarriorCastContext, skill: WarriorSkill): void {
  if (!(skill.movementSkill || MOVEMENT_SKILL_IDS.has(Number(skill.id))) || !hasTrait(context, TRAIT.BRAVE_STRIDE)) {
    return;
  }

  const braveStrideProfile = requireBalanceProfileFromContext(context, PROFILE.braveStride);
  const stability = requireEffect(braveStrideProfile, 'boon', 'stability');
  gainWarriorAdrenaline(context, balanceProfileNumber(braveStrideProfile, 'resourceGain'));
  if (stability)
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
      stacks: effectNumber(braveStrideProfile, stability, 'stacks'),
      duration: gw2SchedulerBoonDuration(
        context,
        skill,
        'stability',
        effectNumber(braveStrideProfile, stability, 'duration')
      )
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

  const profile = requireBalanceProfileFromContext(context, PROFILE.bodyBlow);
  for (const [condition, duration, stacks] of (profile.effects || [])
    .filter((effect) => effect.type === 'condition')
    .map(
      (effect) =>
        [
          String(effect.condition),
          effectNumber(profile, effect, 'duration'),
          effectNumber(profile, effect, 'stacks')
        ] as const
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

  const aggressiveOnslaughtProfile = requireBalanceProfileFromContext(context, PROFILE.aggressiveOnslaught);
  const quickness = requireEffect(aggressiveOnslaughtProfile, 'boon', 'quickness');
  // Reserve this trait's own deadline before emitting its effects.
  if (
    !tryConsumeProcCooldown(
      state.traitProcReadyAt,
      'aggressiveOnslaught',
      event.at,
      balanceProfileNumber(aggressiveOnslaughtProfile, 'internalCooldown')
    )
  )
    return;
  if (quickness)
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
      duration: effectNumber(aggressiveOnslaughtProfile, quickness, 'duration'),
      stacks: effectNumber(aggressiveOnslaughtProfile, quickness, 'stacks'),
      audience: { recipients: 'self' as const }
    });
}

// Restore endurance at the first qualifying hit of a burst activation.
export function applyBuildingMomentum(context: WarriorSchedulerContext, event: WarriorSimulationEvent): void {
  if (!hasTrait(context, TRAIT.BUILDING_MOMENTUM)) return;
  const buildingMomentumProfile = requireBalanceProfileFromContext(context, PROFILE.buildingMomentum);
  gainWarriorEndurance(context, balanceProfileNumber(buildingMomentumProfile, 'resourceGain'), event.at);
}

// Resolve Strength-owned attributes without hiding their formulas in the cross-line composer.
export function modifyWarriorStrengthAttributes(
  context: Gw2ModifierContext,
  result: WarriorModifierAttributes,
  staticRulesApplied: boolean,
  gearPower: number
): void {
  if (hasTrait(context, TRAIT.PINNACLE_OF_STRENGTH)) {
    const pinnacleOfStrengthProfile = requireBalanceProfileFromContext(context, PROFILE.pinnacleOfStrength);
    result.power +=
      Number(context.query?.mightStacksAt(context.time, context.runtime, context.event) || 0) *
      balanceProfileNumber(pinnacleOfStrengthProfile, 'attributeBonus');
  }

  if (hasTrait(context, TRAIT.FORCEFUL_GREATSWORD) && !staticRulesApplied) {
    const forcefulGreatswordProfile = requireBalanceProfileFromContext(context, PROFILE.forcefulGreatsword);
    result.power +=
      balanceProfileNumber(forcefulGreatswordProfile, 'attributeBonus') +
      Number(warriorWieldingWeapon(context, 'Greatsword')) *
        balanceProfileNumber(forcefulGreatswordProfile, 'weaponAttributeBonus');
  }

  if (hasTrait(context, TRAIT.GREAT_FORTITUDE) && !staticRulesApplied) {
    const greatFortitudeProfile = requireBalanceProfileFromContext(context, PROFILE.greatFortitude);
    // Static builds already bake this gear-only conversion; live Might and signets must not feed it.
    const conversion = balanceProfileNumber(greatFortitudeProfile, 'attributeConversion');
    result.vitality += gearPower * conversion;
    result.ferocity += gearPower * conversion;
  }
}

export const warriorStrengthModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'warrior.pinnacle-critical-chance',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: (context) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.PINNACLE_OF_STRENGTH), 'criticalChance'),
    when: (context) => hasTrait(context, TRAIT.PINNACLE_OF_STRENGTH)
  },
  {
    id: 'warrior.berserkers-power',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    parameters: {
      maximumStacks: 4,
      damagePerStack: 0.0375
    } as Readonly<Record<string, number>>,
    amount: (context, _target, parameters) =>
      (context.timeline?.buffStacksAt('berserkers-power', context.time, 0, parameters.maximumStacks) ??
        warriorActiveBuffStacks(context, 'berserkers-power', parameters.maximumStacks)) * parameters.damagePerStack,
    when: (context) => hasTrait(context, TRAIT.BERSERKERS_POWER)
  },
  {
    id: 'warrior.peak-performance',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    parameters: {
      baseBonus: 0.05,
      activeBonus: 0.1
    } as Readonly<Record<string, number>>,
    amount: (context, _target, parameters) =>
      parameters.baseBonus + (warriorActiveBuffStacks(context, 'peak-performance', 1) ? parameters.activeBonus : 0),
    when: (context) => hasTrait(context, TRAIT.PEAK_PERFORMANCE)
  }
]);
