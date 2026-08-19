import type { AvailabilityResult, SimulationEvent } from '../../../../platform/engine/types.js';
import { MODIFIER_TARGET } from '../../../../platform/gw2/modifier-rules.js';
import { gw2StatsForWeaponSet } from '../../../../platform/gw2/runtime-rules.js';
import { hasTrait } from '../../../../platform/gw2/trait-state.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '../../../../platform/gw2/types.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import type { RangerCastContext, RangerPrecastContext, RangerSchedulerContext, RangerSkill } from '../../types.js';
import { druidState } from './state.js';
import {
  advanceDruidState,
  astralForceReadyAt,
  DRUID_ASTRAL_FORCE_DAMAGE_TASK,
  handleDruidAstralForceDamageTask,
  observeDruidAstralForceEvent
} from './mechanics.js';
import { rangerBalanceProfile, rangerBalanceProfileEffect } from '../../core/profiles.js';
import { DRUID_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';

// Grace of the Land emits alacrity; duration scales with concentration/boon duration like any boon
function druidBoonDuration(context: RangerCastContext, baseDuration: number): number {
  const stats = gw2StatsForWeaponSet(context.config, context.state.activeWeaponSet);
  const bonus =
    Number(stats?.concentration || 0) / 1500 +
    Number(stats?.boonDurationBonus || 0) / 100 +
    Number(stats?.boonDurationBonuses?.Alacrity || 0) / 100;
  // Clamped to [1, 2]: boon duration can't go below base and is hard-capped at +100%
  return baseDuration * Math.max(1, Math.min(2, 1 + bonus));
}

function emitGraceOfTheLand(context: RangerCastContext, skill: RangerSkill, at: number): void {
  const effect = rangerBalanceProfileEffect(rangerBalanceProfile(context, PROFILE.graceOfTheLand), 'boon');
  context.emit({
    type: 'buff',
    at,
    source: 'Trait',
    sourceId: TRAIT.GRACE_OF_THE_LAND,
    actorType: 'effect',
    skillId: TRAIT.GRACE_OF_THE_LAND,
    skillName: 'Grace of the Land',
    name: 'Grace of the Land - Alacrity',
    kind: String(effect?.boon || 'alacrity'),
    duration: druidBoonDuration(context, Number(effect?.duration ?? 1)),
    stacks: Number(effect?.stacks ?? 1),
    triggeredBy: skill.name
  });
}

function emitEclipseCondition(
  context: RangerCastContext,
  skill: RangerSkill,
  at: number,
  condition: string,
  duration: number,
  stacks = 1
): void {
  context.emit({
    type: 'condition',
    at,
    source: 'Trait',
    sourceId: TRAIT.ECLIPSE,
    actorType: 'effect',
    skillId: TRAIT.ECLIPSE,
    skillName: 'Eclipse',
    name: `Eclipse - ${condition}`,
    condition,
    duration,
    stacks,
    triggeredBy: skill.name
  });
}

function eclipseEffect(context: RangerCastContext, index: number) {
  return rangerBalanceProfileEffect(rangerBalanceProfile(context, PROFILE.eclipse), 'condition', index);
}

export function applyCelestialAvatarTraits(context: RangerCastContext, skill: RangerSkill): void {
  // Natural Convergence has 4 distinct pulses; all other CA skills emit once at cast start
  const pulses = skill.id === ID.NATURAL_CONVERGENCE ? [520, 1160, 1640, 2040] : [0];
  if (hasTrait(context, TRAIT.GRACE_OF_THE_LAND)) {
    for (const atMs of pulses) {
      emitGraceOfTheLand(context, skill, context.start + atMs / 1000);
    }
  }

  if (!hasTrait(context, TRAIT.ECLIPSE)) return;
  switch (skill.id) {
    case ID.COSMIC_RAY:
      {
        const effect = eclipseEffect(context, 0);
        emitEclipseCondition(
          context,
          skill,
          context.start,
          String(effect?.condition || 'Vulnerability'),
          Number(effect?.duration ?? 8),
          Number(effect?.stacks ?? 1)
        );
      }

      break;
    case ID.SEED_OF_LIFE:
      {
        const effect = eclipseEffect(context, 1);
        emitEclipseCondition(
          context,
          skill,
          context.start,
          String(effect?.condition || 'Poisoned'),
          Number(effect?.duration ?? 8),
          Number(effect?.stacks ?? 3)
        );
      }

      break;
    case ID.LUNAR_IMPACT:
      // Lunar Impact lands at effectiveEnd (it's a ground-targeted projectile with travel time)
      {
        const effect = eclipseEffect(context, 2);
        emitEclipseCondition(
          context,
          skill,
          context.effectiveEnd,
          String(effect?.condition || 'Immobilized'),
          Number(effect?.duration ?? 3),
          Number(effect?.stacks ?? 1)
        );
      }

      break;
    case ID.REJUVENATING_TIDES:
      {
        const effect = eclipseEffect(context, 3);
        emitEclipseCondition(
          context,
          skill,
          context.start,
          String(effect?.condition || 'Chilled'),
          Number(effect?.duration ?? 2),
          Number(effect?.stacks ?? 1)
        );
      }

      break;
    case ID.NATURAL_CONVERGENCE:
      for (const [index, atMs] of pulses.entries()) {
        // Final pulse applies 3 stacks of Burning; all prior pulses apply 1
        const effect = eclipseEffect(context, index === pulses.length - 1 ? 5 : 4);
        emitEclipseCondition(
          context,
          skill,
          context.start + atMs / 1000,
          String(effect?.condition || 'Burning'),
          Number(effect?.duration ?? 5),
          Number(effect?.stacks ?? (index === pulses.length - 1 ? 3 : 1))
        );
      }

      break;
  }
}

function naturalBalanceActive(context: Gw2ModifierContext): boolean {
  if (!hasTrait(context, TRAIT.NATURAL_BALANCE)) return false;
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

export const druidAttributeRules = Object.freeze({
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

function deny(skill: RangerSkill, code: string, cause: string): AvailabilityResult {
  return {
    ready: false,
    code,
    reason: `${skill.name} is unavailable - ${cause}`
  };
}

export function druidCastAvailability(context: RangerPrecastContext, skill: RangerSkill): AvailabilityResult {
  const state = druidState.from(context);
  if (skill.celestialAvatarSkill && !state.celestialAvatarActive) {
    return deny(skill, 'ranger.avatar-inactive', 'enter Celestial Avatar first.');
  }

  if (skill.name === 'Celestial Avatar') {
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

  if (skill.name === 'Release Celestial Avatar' && !state.celestialAvatarActive) {
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
