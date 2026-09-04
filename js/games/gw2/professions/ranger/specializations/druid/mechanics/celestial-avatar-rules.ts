import { emitSkillBuff, emitSkillCondition } from '#gw2/platform/scheduler/skill-events.js';
import type { AvailabilityResult } from '#gw2/platform/engine/execution/types.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/types.js';
import { denySkillCast as deny } from '#gw2/professions/lib/availability.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers/rules.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileEffectFromContext,
  balanceProfileValueFromContext
} from '#gw2/platform/combat/state/balance-profiles.js';
import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers/types.js';
import type { Gw2ResolvedStats } from '#gw2/platform/combat/query/types.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type {
  RangerCastContext,
  RangerPrecastContext,
  RangerSchedulerContext,
  RangerSkill
} from '#gw2/professions/ranger/types.js';
import { druidState } from '#gw2/professions/ranger/specializations/druid/state.js';
import {
  advanceDruidState,
  astralForceReadyAt,
  DRUID_ASTRAL_FORCE_DAMAGE_TASK,
  handleDruidAstralForceDamageTask,
  observeDruidAstralForceEvent
} from '#gw2/professions/ranger/specializations/druid/mechanics/celestial-avatar.js';

import { DRUID_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/specializations/druid/profiles.js';

function eclipseEffect(context: RangerCastContext, index: number) {
  return balanceProfileEffectFromContext(context, PROFILE.eclipse, 'condition', index);
}

export function applyCelestialAvatarTraits(context: RangerCastContext, skill: RangerSkill): void {
  // Natural Convergence has 4 distinct pulses; all other CA skills emit once at cast start
  const pulses = skill.id === ID.NATURAL_CONVERGENCE ? [520, 1160, 1640, 2040] : [0];
  if (hasTrait(context, TRAIT.GRACE_OF_THE_LAND)) {
    const effect = balanceProfileEffectFromContext(context, PROFILE.graceOfTheLand, 'boon');
    const boon = String(effect?.boon || 'alacrity');
    for (const atMs of pulses) {
      emitSkillBuff(context, skill, {
        at: context.start + atMs / 1000,
        source: 'Trait',
        sourceId: TRAIT.GRACE_OF_THE_LAND,
        actorType: 'effect',
        skillId: TRAIT.GRACE_OF_THE_LAND,
        skillName: 'Grace of the Land',
        name: 'Grace of the Land - Alacrity',
        kind: boon,
        duration: Number(effect?.duration ?? 1),
        stacks: Number(effect?.stacks ?? 1),
        triggeredBy: skill.name
      });
    }
  }

  if (!hasTrait(context, TRAIT.ECLIPSE)) return;
  const applications: Array<{ at: number; condition: string; duration: number; stacks: number }> = [];
  switch (skill.id) {
    case ID.COSMIC_RAY:
      {
        const effect = eclipseEffect(context, 0);
        applications.push({
          at: context.start,
          condition: String(effect?.condition || 'Vulnerability'),
          duration: Number(effect?.duration ?? 8),
          stacks: Number(effect?.stacks ?? 1)
        });
      }

      break;
    case ID.SEED_OF_LIFE:
      {
        const effect = eclipseEffect(context, 1);
        applications.push({
          at: context.start,
          condition: String(effect?.condition || 'Poisoned'),
          duration: Number(effect?.duration ?? 8),
          stacks: Number(effect?.stacks ?? 3)
        });
      }

      break;
    case ID.LUNAR_IMPACT:
      // Lunar Impact lands at effectiveEnd (it's a ground-targeted projectile with travel time)
      {
        const effect = eclipseEffect(context, 2);
        applications.push({
          at: context.effectiveEnd,
          condition: String(effect?.condition || 'Immobilized'),
          duration: Number(effect?.duration ?? 3),
          stacks: Number(effect?.stacks ?? 1)
        });
      }

      break;
    case ID.REJUVENATING_TIDES:
      {
        const effect = eclipseEffect(context, 3);
        applications.push({
          at: context.start,
          condition: String(effect?.condition || 'Chilled'),
          duration: Number(effect?.duration ?? 2),
          stacks: Number(effect?.stacks ?? 1)
        });
      }

      break;
    case ID.NATURAL_CONVERGENCE:
      for (const [index, atMs] of pulses.entries()) {
        // Final pulse applies 3 stacks of Burning; all prior pulses apply 1
        const effect = eclipseEffect(context, index === pulses.length - 1 ? 5 : 4);
        applications.push({
          at: context.start + atMs / 1000,
          condition: String(effect?.condition || 'Burning'),
          duration: Number(effect?.duration ?? 5),
          stacks: Number(effect?.stacks ?? (index === pulses.length - 1 ? 3 : 1))
        });
      }

      break;
  }

  // Keep every Eclipse packet explicit while sharing only the authored application list.
  for (const application of applications) {
    emitSkillCondition(context, {
      at: application.at,
      source: 'Trait',
      sourceId: TRAIT.ECLIPSE,
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
    amount: 0.05,
    when: naturalBalanceActive
  },
  {
    id: 'ranger.natural-balance-condition-duration',
    target: MODIFIER_TARGET.CONDITION_DURATION,
    operation: 'add',
    amount: 0.1,
    when: naturalBalanceActive
  }
]);

/** Applies Druid-owned attribute bonuses without making Core aware of the specialization. */
function modifyDruidAttributes(context: Gw2ModifierContext, attributes: Gw2ResolvedStats): Gw2ResolvedStats {
  if (!hasTrait(context, TRAIT.NATURAL_FORTITUDE)) return attributes;
  const staticRulesApplied = professionStaticRulesApplied(context.config);
  if (staticRulesApplied && context.event?.actorType === 'summon') return attributes;
  const result = { ...attributes };
  const vitality = balanceProfileValueFromContext(context, PROFILE.naturalFortitude, 'attributeBonus', 240);
  result.vitality = Number(result.vitality || 0) + vitality - (staticRulesApplied ? 240 : 0);
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
      observeDruidAstralForceEvent(context, event);
    }
  },
  taskHandlers: {
    [DRUID_ASTRAL_FORCE_DAMAGE_TASK]: handleDruidAstralForceDamageTask
  }
});

export function druidCastAvailability(context: RangerPrecastContext, skill: RangerSkill): AvailabilityResult {
  const state = druidState.from(context);
  if (skill.celestialAvatarSkill && !state.celestialAvatarActive) {
    return deny(skill, 'ranger.avatar-inactive', 'enter Celestial Avatar first.');
  }

  if (skill.id === ID.CELESTIAL_AVATAR) {
    if (state.celestialAvatarActive) {
      return deny(skill, 'ranger.avatar-active', 'Celestial Avatar is already active.');
    }

    if (state.astralForce < state.maximumAstralForce) {
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
