/** Owns Core Ranger Skirmishing dodge, weapon-swap, and critical-hit trait behavior. */
import { emitSkillBuff } from '#gw2/platform/scheduler/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileEffectFromContext as profileEffect,
  balanceProfileFromContext,
  balanceProfileEffect,
  balanceProfileValueFromContext
} from '#gw2/platform/combat/state/balance-profiles.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/scheduler/policy.js';
import type { ResolvedCriticalHitOptions } from '#gw2/integrations/patches/authoring/mechanics.js';
import type { NativeResolvedDamageDetails } from '#gw2/integrations/patches/authoring/module-types.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/content/professions/ranger/data/ids.js';
import { queueBleeding } from '#gw2/content/professions/ranger/core/mechanics/resolution-helpers.js';
import type {
  RangerCastContext,
  RangerResolverContext,
  RangerResolverEvent,
  RangerSchedulerContext,
  RangerSkill
} from '#gw2/content/professions/ranger/types.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/ranger/core/profiles.js';

type RangerCriticalHitDefinition = ResolvedCriticalHitOptions<
  RangerResolverContext,
  RangerResolverEvent,
  NativeResolvedDamageDetails
>;

export function applyRangerDodgeTraits(context: RangerCastContext, at = context.effectiveEnd): void {
  if (!hasTrait(context, TRAIT.LIGHT_ON_YOUR_FEET)) return;
  const effect = profileEffect(context, PROFILE.lightOnYourFeet, 'buff');
  const kind = String(effect?.kind || 'light-on-your-feet');
  const baseDuration = Number(effect?.duration ?? 6);
  // Reapplications stack duration in game, so preserve the live remainder
  // instead of replacing it with another six-second overlapping window.
  const activeUntil = context.events
    .filter((event) => event.type === 'buff' && event.kind === kind && event.at <= at)
    .reduce((maximum, event) => Math.max(maximum, event.at + Number(event.duration || 0)), at);
  emitSkillBuff(context, {
    at,
    source: 'Trait',
    sourceId: TRAIT.LIGHT_ON_YOUR_FEET,
    actorType: 'effect',
    skillId: TRAIT.LIGHT_ON_YOUR_FEET,
    skillName: 'Light on your Feet',
    kind,
    duration: baseDuration + Math.max(0, activeUntil - at),
    stacks: Number(effect?.stacks ?? 1)
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
    const profile = balanceProfileFromContext(context, PROFILE.tailWind);
    const effect = balanceProfileEffect(profile, 'boon');
    state.tailWindReadyAt = at + Number(profile?.internalCooldown ?? 9);
    emitSkillBuff(context, {
      at,
      source: 'Trait',
      sourceId: TRAIT.TAIL_WIND,
      actorType: 'effect',
      skillId: skill.id,
      skillName: 'Tail Wind',
      kind: String(effect?.boon || 'swiftness'),
      duration: gw2SchedulerBoonDuration(
        context,
        skill,
        String(effect?.boon || 'swiftness'),
        Number(effect?.duration ?? 9)
      ),
      stacks: Number(effect?.stacks ?? 1)
    });
  }

  if (
    inCombat &&
    hasTrait({ config: context.config }, TRAIT.QUICK_DRAW) &&
    isInternalCooldownReady(at, state.quickDrawReadyAt)
  ) {
    const profile = balanceProfileFromContext(context, PROFILE.quickDraw);
    const effect = balanceProfileEffect(profile, 'boon');
    state.quickDrawReadyAt = at + Number(profile?.internalCooldown ?? 9);
    state.quickDrawUntil = at + Number(profile?.durationMultiplier ?? 5);
    emitSkillBuff(context, {
      at,
      source: 'Trait',
      sourceId: TRAIT.QUICK_DRAW,
      actorType: 'effect',
      skillId: skill.id,
      skillName: 'Quick Draw',
      kind: String(effect?.boon || 'quickness'),
      duration: gw2SchedulerBoonDuration(
        context,
        skill,
        String(effect?.boon || 'quickness'),
        Number(effect?.duration ?? 3)
      ),
      stacks: Number(effect?.stacks ?? 1)
    });
  }

  if (
    inCombat &&
    hasTrait({ config: context.config }, TRAIT.FURIOUS_GRIP) &&
    isInternalCooldownReady(at, state.furiousGripReadyAt)
  ) {
    const profile = balanceProfileFromContext(context, PROFILE.furiousGrip);
    const effect = balanceProfileEffect(profile, 'boon');
    state.furiousGripReadyAt = at + Number(profile?.internalCooldown ?? 9);
    emitSkillBuff(context, {
      at,
      source: 'Trait',
      sourceId: TRAIT.FURIOUS_GRIP,
      actorType: 'effect',
      skillId: skill.id,
      skillName: 'Furious Grip',
      kind: String(effect?.boon || 'fury'),
      duration: gw2SchedulerBoonDuration(context, skill, String(effect?.boon || 'fury'), Number(effect?.duration ?? 5)),
      stacks: Number(effect?.stacks ?? 1)
    });
  }
}

export const rangerCoreCriticalReactions = Object.freeze({
  id: 'ranger.sharpened-edges',
  order: 20,
  materialization: 'threshold',
  chanceOnCriticalHit: 0.33,
  actorTypes: ['player', 'summon'] as const,
  when(context: RangerResolverContext, event: RangerResolverEvent): boolean {
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
    // Sharpened Edges emits one bleeding application per threshold proc.
    for (let proc = 0; proc < application.quantity; proc += 1) {
      const bleeding = profileEffect(context, PROFILE.sharpenedEdges, 'condition');
      queueBleeding(
        context,
        event,
        Number(bleeding?.duration ?? 3),
        TRAIT.SHARPENED_EDGES,
        'Sharpened Edges',
        Number(bleeding?.stacks ?? 1)
      );
    }
  }
} satisfies RangerCriticalHitDefinition);

export const rangerCoreProfiledCriticalReaction = Object.freeze({
  ...rangerCoreCriticalReactions,
  chanceOnCriticalHit: (context: RangerResolverContext) =>
    balanceProfileValueFromContext(context, PROFILE.sharpenedEdges, 'criticalChance', 0.33)
} satisfies RangerCriticalHitDefinition);
