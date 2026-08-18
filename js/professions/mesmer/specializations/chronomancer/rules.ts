import { chronomancerState } from './state.js';
import { MESMER_SKILL_IDS as ID } from '../../data/ids.js';
import { MESMER_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { EPSILON } from '../../../../platform/engine/clock.js';
import { MODIFIER_TARGET } from '../../../../platform/gw2/modifier-rules.js';
import { hasTrait } from '../../../../platform/gw2/trait-state.js';
import { timedActive } from '../../core/rules.js';
import { mesmerRuntimeFor } from '../../core/runtime.js';
import { initializeChronomancerRuntime } from './runtime.js';
import type { Gw2ModifierRule } from '../../../../platform/gw2/types.js';
import type { AvailabilityResult } from '../../../../platform/engine/types.js';
import type { MesmerPrecastContext, MesmerSchedulerContext, MesmerSchedulerTask, MesmerSkill } from '../../types.js';

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

export const chronomancerCastRules = Object.freeze({
  availability: {
    id: 'mesmer.chronomancer.availability',
    order: 20,
    handler: chronomancerAvailability
  }
});

export const chronomancerModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
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
  mesmerRuntimeFor(context).continuum.restoreContinuum(task.at, 'split expired');
}

export const chronomancerSchedulerHooks = Object.freeze({
  taskHandlers: Object.freeze({
    'mesmer.continuum-expire': handleContinuumExpiryTask
  })
});

export const chronomancerAttributeRules = Object.freeze({
  modifierRules: chronomancerModifierRules
});

export const chronomancerRuntimeHooks = Object.freeze({
  ...chronomancerSchedulerHooks,
  initialize: initializeChronomancerRuntime
});
