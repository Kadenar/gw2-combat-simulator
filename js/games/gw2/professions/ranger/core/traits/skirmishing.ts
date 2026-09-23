/** Owns Core Ranger Skirmishing dodge, weapon-swap, and critical-hit trait behavior. */
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { emitSkillBuff } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/execution/gw2-policy/policy.js';
import type { ResolvedCriticalHitOptions } from '#gw2/platform/profession-definition/mechanics.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { queueBleeding } from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import type {
  RangerCastContext,
  RangerResolverContext,
  RangerSchedulerContext,
  RangerSkill
} from '#gw2/professions/ranger/types.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/core/profiles.js';
import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';

type RangerCriticalHitDefinition = ResolvedCriticalHitOptions<
  RangerResolverContext,
  Gw2ResolverEvent,
  NativeResolvedDamageDetails
>;

export function applyRangerDodgeTraits(context: RangerCastContext, at = context.effectiveEnd): void {
  if (!hasTrait(context, TRAIT.LIGHT_ON_YOUR_FEET)) return;
  const profile = requireBalanceProfileFromContext(context, PROFILE.lightOnYourFeet);
  const effect = requireEffect(profile, 'buff', 'light-on-your-feet');
  if (!effect) return;
  const kind = String(effect.kind);
  const baseDuration = effectNumber(profile, effect, 'duration');
  // Reapplications stack duration in game, so preserve the live remainder
  // instead of replacing it with another six-second overlapping window.
  const activeUntil = context.events
    .filter((event) => event.type === 'buff' && event.kind === kind && event.at <= at)
    .reduce((maximum, event) => Math.max(maximum, gw2EffectExpiresAt(event.at, Number(event.duration || 0))), at);
  emitSkillBuff(context, {
    at,
    source: 'Trait',
    sourceId: TRAIT.LIGHT_ON_YOUR_FEET,
    actorType: 'effect',
    skillId: TRAIT.LIGHT_ON_YOUR_FEET,
    skillName: 'Light on your Feet',
    kind,
    duration: baseDuration + Math.max(0, activeUntil - at),
    stacks: effectNumber(profile, effect, 'stacks')
  });
}

// Apply combat-only weapon-swap traits on independent ICDs and arm Quick Draw's
// one-use window for the next qualifying weapon skill.
export function applyRangerWeaponSwapTraits(
  context: RangerCastContext | RangerSchedulerContext,
  skill: RangerSkill,
  at = 'effectiveEnd' in context ? context.effectiveEnd : context.state.time
): void {
  const state = professionCoreState(context);
  const inCombat = context.combatStartTime != null && at >= context.combatStartTime;
  if (
    inCombat &&
    hasTrait({ config: context.config }, TRAIT.TAIL_WIND) &&
    isInternalCooldownReady(at, state.tailWindReadyAt)
  ) {
    const profile = requireBalanceProfileFromContext(context, PROFILE.tailWind);
    const effect = requireEffect(profile, 'boon', 'swiftness');
    // The cooldown gates only swiftness, so a removed boon leaves it ready.
    if (effect) {
      state.tailWindReadyAt = at + balanceProfileNumber(profile, 'internalCooldown');
      emitSkillBuff(context, {
        at,
        source: 'Trait',
        sourceId: TRAIT.TAIL_WIND,
        actorType: 'effect',
        skillId: skill.id,
        skillName: 'Tail Wind',
        kind: String(effect.boon),
        duration: gw2SchedulerBoonDuration(
          context,
          skill,
          String(effect.boon),
          effectNumber(profile, effect, 'duration')
        ),
        stacks: effectNumber(profile, effect, 'stacks')
      });
    }
  }

  if (
    inCombat &&
    hasTrait({ config: context.config }, TRAIT.QUICK_DRAW) &&
    isInternalCooldownReady(at, state.quickDrawReadyAt)
  ) {
    const profile = requireBalanceProfileFromContext(context, PROFILE.quickDraw);
    const effect = requireEffect(profile, 'boon', 'quickness');
    // The recharge window is trait-owned, so it and its cooldown survive a removed quickness packet.
    state.quickDrawReadyAt = at + balanceProfileNumber(profile, 'internalCooldown');
    state.quickDrawUntil = at + balanceProfileNumber(profile, 'durationMultiplier');
    if (effect)
      emitSkillBuff(context, {
        at,
        source: 'Trait',
        sourceId: TRAIT.QUICK_DRAW,
        actorType: 'effect',
        skillId: skill.id,
        skillName: 'Quick Draw',
        kind: String(effect.boon),
        duration: gw2SchedulerBoonDuration(
          context,
          skill,
          String(effect.boon),
          effectNumber(profile, effect, 'duration')
        ),
        stacks: effectNumber(profile, effect, 'stacks')
      });
  }

  if (
    inCombat &&
    hasTrait({ config: context.config }, TRAIT.FURIOUS_GRIP) &&
    isInternalCooldownReady(at, state.furiousGripReadyAt)
  ) {
    const profile = requireBalanceProfileFromContext(context, PROFILE.furiousGrip);
    const effect = requireEffect(profile, 'boon', 'fury');
    // The cooldown gates only fury, so a removed boon leaves it ready.
    if (effect) {
      state.furiousGripReadyAt = at + balanceProfileNumber(profile, 'internalCooldown');
      emitSkillBuff(context, {
        at,
        source: 'Trait',
        sourceId: TRAIT.FURIOUS_GRIP,
        actorType: 'effect',
        skillId: skill.id,
        skillName: 'Furious Grip',
        kind: String(effect.boon),
        duration: gw2SchedulerBoonDuration(
          context,
          skill,
          String(effect.boon),
          effectNumber(profile, effect, 'duration')
        ),
        stacks: effectNumber(profile, effect, 'stacks')
      });
    }
  }
}

export const rangerCoreCriticalReactions = Object.freeze({
  id: 'ranger.sharpened-edges',
  order: 20,
  materialization: 'threshold',
  chanceOnCriticalHit: 0.33,
  actorTypes: ['player', 'summon'] as const,
  when(context: RangerResolverContext, event: Gw2ResolverEvent): boolean {
    return hasTrait(context, TRAIT.SHARPENED_EDGES) && (event.actorType === 'player' || event.source === 'ranger-pet');
  },
  expectedProgress: {
    get(context: RangerResolverContext): number {
      return professionCoreState(context).sharpenedEdgesProgress;
    },
    set(context: RangerResolverContext, value: number): void {
      professionCoreState(context).sharpenedEdgesProgress = value;
    }
  },
  attribution: {
    kind: 'trait' as const,
    id: TRAIT.SHARPENED_EDGES
  },
  handler(context, event, _details, application): void {
    // Reuse this invocation's authored effect, emitting one bleeding application per threshold proc.
    const profile = requireBalanceProfileFromContext(context, PROFILE.sharpenedEdges);
    const bleeding = requireEffect(profile, 'condition', 'Bleeding');
    if (!bleeding) return;
    const duration = effectNumber(profile, bleeding, 'duration');
    const stacks = effectNumber(profile, bleeding, 'stacks');
    for (let proc = 0; proc < application.quantity; proc += 1) {
      queueBleeding(context, event, duration, TRAIT.SHARPENED_EDGES, 'Sharpened Edges', stacks);
    }
  }
} satisfies RangerCriticalHitDefinition);

export const rangerCoreProfiledCriticalReaction = Object.freeze({
  ...rangerCoreCriticalReactions,
  chanceOnCriticalHit: (context: RangerResolverContext) =>
    balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.sharpenedEdges), 'criticalChance')
} satisfies RangerCriticalHitDefinition);
