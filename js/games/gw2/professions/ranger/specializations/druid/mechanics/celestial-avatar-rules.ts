import { EPSILON } from '#kernel/core/clock.js';
import { emitSkillBuff, emitSkillCondition } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import { denySkillCast as deny } from '#gw2/professions/shared/availability.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type { Gw2ResolvedStats } from '#gw2/platform/combat/query/combat-query.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type { RangerCastContext, RangerSchedulerContext, RangerSkill } from '#gw2/professions/ranger/types.js';
import { druidState } from '#gw2/professions/ranger/specializations/druid/state.js';
import {
  advanceDruidState,
  astralForceReadyAt,
  avatarDepletion,
  druidAstralForceReaction
} from '#gw2/professions/ranger/specializations/druid/mechanics/celestial-avatar.js';

import { DRUID_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/specializations/druid/profiles.js';
import { castCompleted } from '#gw2/platform/skills/timing.js';

// Eclipse packets are keyed by their Celestial Avatar skill so removing one never rebinds another skill's condition.
const ECLIPSE_EFFECTS: ReadonlyMap<RangerSkill['id'], string> = new Map<RangerSkill['id'], string>([
  [ID.COSMIC_RAY, 'Cosmic Ray'],
  [ID.SEED_OF_LIFE, 'Seed of Life'],
  [ID.LUNAR_IMPACT, 'Lunar Impact'],
  [ID.REJUVENATING_TIDES, 'Rejuvenating Tides']
]);

export function applyCelestialAvatarTraits(context: RangerCastContext, skill: RangerSkill): void {
  // Natural Convergence has 4 distinct pulses; all other CA skills emit once at cast start
  const pulses = skill.id === ID.NATURAL_CONVERGENCE ? [520, 1160, 1640, 2040] : [0];
  // Channel traits stop with the cast, while already-applied conditions keep ticking.
  const pulseLanded = (at: number) =>
    skill.id !== ID.NATURAL_CONVERGENCE || castCompleted(context) || at <= context.effectiveEnd + EPSILON;
  const graceProfile = hasTrait(context, TRAIT.GRACE_OF_THE_LAND)
    ? requireBalanceProfileFromContext(context, PROFILE.graceOfTheLand)
    : undefined;
  const grace = graceProfile && requireEffect(graceProfile, 'boon', 'alacrity');
  if (graceProfile && grace) {
    const boon = String(grace.boon);
    const duration = effectNumber(graceProfile, grace, 'duration');
    const stacks = effectNumber(graceProfile, grace, 'stacks');
    for (const atMs of pulses) {
      if (!pulseLanded(context.start + atMs / 1000)) continue;
      emitSkillBuff(context, skill, {
        at: context.start + atMs / 1000,
        source: 'Trait',
        sourceId: TRAIT.GRACE_OF_THE_LAND,
        actorType: 'effect',
        skillId: TRAIT.GRACE_OF_THE_LAND,
        skillName: 'Grace of the Land',
        name: 'Grace of the Land - Alacrity',
        kind: boon,
        duration,
        stacks,
        triggeredBy: skill.name
      });
    }
  }

  if (!hasTrait(context, TRAIT.ECLIPSE)) return;
  const singleEffect = ECLIPSE_EFFECTS.get(skill.id);
  const pulseEffects =
    skill.id === ID.NATURAL_CONVERGENCE
      ? // Final pulse uses its own authored packet; all prior pulses share the ordinary pulse packet.
        pulses.map((atMs, index) => ({
          at: context.start + atMs / 1000,
          name: index === pulses.length - 1 ? 'Natural Convergence final pulse' : 'Natural Convergence'
        }))
      : singleEffect
        ? // Lunar Impact lands at effectiveEnd (it's a ground-targeted projectile with travel time)
          [{ at: skill.id === ID.LUNAR_IMPACT ? context.effectiveEnd : context.start, name: singleEffect }]
        : [];
  if (!pulseEffects.length) return;
  const eclipse = requireBalanceProfileFromContext(context, PROFILE.eclipse);
  const applications: Array<{ at: number; condition: string; duration: number; stacks: number }> = [];
  for (const { at, name } of pulseEffects) {
    const effect = requireEffect(eclipse, 'condition', name);
    if (!effect) continue;
    applications.push({
      at,
      condition: String(effect.condition),
      duration: effectNumber(eclipse, effect, 'duration'),
      stacks: effectNumber(eclipse, effect, 'stacks')
    });
  }

  // Keep every Eclipse packet explicit while sharing only the authored application list.
  for (const application of applications) {
    if (!pulseLanded(application.at)) continue;
    emitSkillCondition(context, {
      at: application.at,
      source: 'Trait',
      actorType: 'effect',
      ownerActorType: 'player',
      skillId: TRAIT.ECLIPSE,
      skillName: 'Eclipse',
      name: `Eclipse - ${application.condition}`,
      condition: application.condition,
      duration: application.duration,
      stacks: application.stacks,
      triggeredBy: skill.name
    });
  }
}

function naturalBalanceActive(context: Gw2ModifierContext): boolean {
  // Natural Balance modifies the Druid, not independently scaled pet conditions.
  if (!isGw2PlayerModifierOwnedEvent(context.event) || !hasTrait(context, TRAIT.NATURAL_BALANCE)) return false;
  // Scheduler path uses a timeline; resolver path reads from the runtime boon list
  if (context.timeline?.timedActive('natural-balance', context.time)) return true;
  return (context.runtime?.boons?.get('natural-balance') || []).some(
    (application: { at: number; expiresAt: number; stacks: number }) =>
      application.at <= context.time && application.expiresAt > context.time && application.stacks > 0
  );
}

export const druidModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'ranger.natural-balance-condition-damage',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'damage-additive',
    amount: (context) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.NATURAL_BALANCE), 'conditionDamageIncrease'),
    when: naturalBalanceActive
  },
  {
    id: 'ranger.natural-balance-condition-duration',
    target: MODIFIER_TARGET.CONDITION_DURATION,
    operation: 'add',
    amount: (context) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.NATURAL_BALANCE), 'conditionDurationBonus'),
    when: naturalBalanceActive
  }
]);

/** Applies Druid-owned attribute bonuses without making Core aware of the specialization. */
function modifyDruidAttributes(context: Gw2ModifierContext, attributes: Gw2ResolvedStats): Gw2ResolvedStats {
  if (!hasTrait(context, TRAIT.NATURAL_FORTITUDE)) return attributes;
  const staticRulesApplied = professionStaticRulesApplied(context.config);
  if (staticRulesApplied && context.event?.actorType === 'summon') return attributes;
  const result = { ...attributes };
  const naturalFortitudeProfile = requireBalanceProfileFromContext(context, PROFILE.naturalFortitude);
  const vitality = balanceProfileNumber(naturalFortitudeProfile, 'attributeBonus');
  result.vitality = Number(result.vitality || 0) + (staticRulesApplied ? 0 : vitality);
  return result;
}

export const druidAttributeRules = Object.freeze({
  modifyAttributes: modifyDruidAttributes,
  modifierRules: druidModifierRules
});

export const druidSchedulerHooks = Object.freeze({
  advance: {
    id: 'ranger.druid-advance',
    order: 20,
    handler: advanceDruidState
  },
  onEventScheduled: {
    id: 'ranger.druid-astral-force-events',
    order: 20,
    handler(context: RangerSchedulerContext, event: SimulationEvent): void {
      druidAstralForceReaction.onEventScheduled.handler(context, event);
    }
  },
  taskHandlers: {
    ...avatarDepletion.taskHandlers,
    ...druidAstralForceReaction.taskHandlers
  }
});

export function druidCastAvailability(context: RangerCastContext, skill: RangerSkill): AvailabilityResult {
  const state = druidState.from(context);
  if (skill.celestialAvatarSkill && !state.celestialAvatarActive) {
    return deny(skill, 'ranger.avatar-inactive', 'enter Celestial Avatar first.');
  }

  if (skill.id === ID.CELESTIAL_AVATAR) {
    if (state.celestialAvatarActive) {
      return deny(skill, 'ranger.avatar-active', 'Celestial Avatar is already active.');
    }

    if (state.astralClock.value < state.astralClock.maximum) {
      const retryAt = astralForceReadyAt(context);
      // Provide a retryAt when Natural Mender can predict the ready time so the scheduler waits instead of skipping
      if (retryAt != null) {
        return {
          ready: false,
          retryAt,
          code: 'ranger.astral-force',
          reason: `${skill.name} is recharging astral force.`
        };
      }

      // No retryAt: force only comes from hits, can't predict when it will be full
      return deny(skill, 'ranger.astral-force', 'requires full astral force.');
    }
  }

  if (skill.id === ID.RELEASE_CELESTIAL_AVATAR && !state.celestialAvatarActive) {
    return deny(skill, 'ranger.avatar-inactive', 'Celestial Avatar is not active.');
  }

  if (state.celestialAvatarActive && skill.type === 'Weapon' && !skill.celestialAvatarSkill) {
    return deny(skill, 'ranger.avatar-weapon-bar', 'Celestial Avatar replaces weapon skills.');
  }

  return { ready: true };
}

export const druidCastRules = Object.freeze({
  availability: {
    id: 'ranger.druid-availability',
    order: 20,
    handler: druidCastAvailability
  }
});
