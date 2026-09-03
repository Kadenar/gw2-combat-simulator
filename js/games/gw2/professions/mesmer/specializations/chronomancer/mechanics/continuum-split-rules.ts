import { chronomancerState } from '#gw2/professions/mesmer/specializations/chronomancer/state.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { EPSILON } from '#kernel/core/clock.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers/rules.js';
import { targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { timedActive } from '#gw2/professions/mesmer/core/traits/modifiers.js';
import { mesmerRuntimeFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import {
  chronomancerControllerFor,
  initializeChronomancerRuntime
} from '#gw2/professions/mesmer/specializations/chronomancer/mechanics/runtime.js';
import { completeChronomancerTimeBomb } from '#gw2/professions/mesmer/specializations/chronomancer/mechanics/time-bomb.js';
import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers/types.js';
import type { AvailabilityResult, SimulationEvent } from '#gw2/platform/engine/types.js';
import type {
  MesmerPrecastContext,
  MesmerRechargeContext,
  MesmerSchedulerContext
} from '#gw2/professions/mesmer/types.js';
import type { MesmerSchedulerTask } from '#gw2/professions/mesmer/state/types.js';

import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

function chronomancerAvailability(context: MesmerPrecastContext, skill: MesmerSkill): AvailabilityResult {
  if (skill.id !== ID.CONTINUUM_SHIFT || chronomancerState.from(context).continuum) {
    return { ready: true };
  }

  return {
    ready: false,
    retryAt: null,
    code: 'mesmer.continuum-inactive',
    reason: `${skill.name} requires an active Continuum Split.`
  };
}

/** Upgrades Alacrity's recharge rate for Chronomancer while preserving Core exclusions. */
function modifyChronomancerRecharge(context: MesmerRechargeContext, sharedDuration: number): number {
  if (
    !context.config.boons?.alacrity ||
    context.ammoCastLockout ||
    context.skill.id === ID.SWAP_WEAPONS ||
    sharedDuration === 0
  ) {
    return sharedDuration;
  }

  return (sharedDuration * 1.25) / 1.5;
}

export const chronomancerCastRules = Object.freeze({
  availability: {
    id: 'mesmer.chronomancer.availability',
    order: 20,
    handler: chronomancerAvailability
  },
  modifyRechargeDuration: modifyChronomancerRecharge
});

export const chronomancerModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'mesmer.time-catches-up',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    order: 100,
    // Time Catches Up affects only first-strike shatter packets against a movement-impaired target.
    when: (context) =>
      hasTrait(context, TRAIT.TIME_CATCHES_UP) &&
      Boolean(context.event?.shatterTraitEligible) &&
      ['Chilled', 'Cripple', 'Immobilized', 'Slow'].some((condition) => targetConditionActive(context, condition))
  },
  {
    id: 'mesmer.flow-of-time-critical-chance',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: 0.15,
    when: (context) =>
      hasTrait(context, TRAIT.FLOW_OF_TIME) &&
      Boolean(context.config?.boons?.alacrity) &&
      ['Player', 'Clone', 'Phantasm'].includes(String(context.event?.source || ''))
  },
  {
    id: 'mesmer.danger-time',
    target: MODIFIER_TARGET.CRITICAL_DAMAGE,
    operation: 'multiply',
    factor: 1.05,
    when: (context) =>
      hasTrait(context, TRAIT.DANGER_TIME) &&
      ['Player', 'Clone', 'Phantasm'].includes(String(context.event?.source || '')) &&
      timedActive(context, 'danger-time')
  },
  {
    id: 'mesmer.time-bomb',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    order: 100,
    when: (context) => String(context.event?.source || '') === 'Player' && timedActive(context, 'time-bomb')
  }
]);

export function handleContinuumExpiryTask(
  context: MesmerSchedulerContext,
  task: MesmerSchedulerTask<'continuumExpire'>
): void {
  const active = chronomancerState.from(context).continuum;
  if (!active || Math.abs(active.expiresAt - task.payload.expiresAt) > EPSILON) return;
  chronomancerControllerFor(mesmerRuntimeFor(context)).restoreContinuum(task.at, 'split expired');
}

/** Arms Danger Time from Chronomancer control packets and Delayed Reactions. */
function observeChronomancerEvent(context: MesmerSchedulerContext, event: SimulationEvent): void {
  if (event.type !== 'control') return;
  const runtime = mesmerRuntimeFor(context);
  const skillId = Number(event.skillId);
  if (
    !runtime.traits.has(TRAIT.DANGER_TIME) ||
    (skillId !== ID.TIME_SINK && !runtime.traits.has(TRAIT.DELAYED_REACTIONS))
  ) {
    return;
  }

  const skillName = String(event.skillName || event.name || 'Control effect');
  runtime.addEvent({
    type: 'buff',
    at: event.at,
    kind: 'danger-time',
    stacks: 1,
    duration: Number(runtime.balanceProfile(TRAIT.DANGER_TIME)?.durationMultiplier || 10),
    sourceSkill: skillName
  });
  runtime.addTraitProc('Danger Time', event.at, skillName);
}

export const chronomancerSchedulerHooks = Object.freeze({
  onCastComplete: {
    id: 'mesmer.chronomancer.time-bomb',
    order: 20,
    handler: completeChronomancerTimeBomb
  },
  onEventScheduled: {
    id: 'mesmer.chronomancer.danger-time',
    order: 20,
    handler: observeChronomancerEvent
  },
  taskHandlers: Object.freeze({
    'mesmer.continuum-expire': handleContinuumExpiryTask
  })
});

/** Restores a manually ended Continuum Split through skill-owned trigger metadata. */
export const chronomancerSkillMechanicHandlers = Object.freeze({
  'mesmer.chronomancer.restore-continuum': ({ context, at }: { context: MesmerSchedulerContext; at: number }): void => {
    chronomancerControllerFor(mesmerRuntimeFor(context)).restoreContinuum(at, 'manual shift');
  }
});

export const chronomancerAttributeRules = Object.freeze({
  modifierRules: chronomancerModifierRules
});

export const chronomancerRuntimeHooks = Object.freeze({
  ...chronomancerSchedulerHooks,
  initialize: initializeChronomancerRuntime
});
