import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import type { GuardianWillbenderState } from '#gw2/professions/guardian/types.js';

export function createWillbenderState(): GuardianWillbenderState {
  return {
    flameGeneration: 0, // increments each time a different virtue activates, invalidating queued pulses from the prior virtue
    flameVirtue: null,
    pendingWeaponCooldownReduction: {}, // keyed by reservationId; accumulates in-flight reductions and cleared on cast-complete
    justiceUntil: 0,
    resolveUntil: 0,
    courageUntil: 0,
    virtueHitCounts: {
      justice: 0,
      resolve: 0,
      courage: 0
    },
    lethalTempoStacks: 0,
    lethalTempoUntil: 0,
    triggeredVirtueEffects: 0
  };
}

/** Keeps Willbender projection ownership beside the state that produces it. */
export const WILLBENDER_PUBLIC_END_STATE_KEYS: readonly (keyof GuardianWillbenderState)[] = Object.freeze([
  'flameGeneration',
  'flameVirtue',
  'justiceUntil',
  'resolveUntil',
  'courageUntil',
  'virtueHitCounts',
  'lethalTempoStacks',
  'lethalTempoUntil',
  'triggeredVirtueEffects'
]);

export const WILLBENDER_RESOLVER_END_STATE_KEYS = WILLBENDER_PUBLIC_END_STATE_KEYS;

export const WILLBENDER_PUBLIC_END_STATE_DEFAULTS: Readonly<Partial<GuardianWillbenderState>> = Object.freeze({
  flameGeneration: 0,
  flameVirtue: null,
  justiceUntil: 0,
  resolveUntil: 0,
  courageUntil: 0,
  virtueHitCounts: { justice: 0, resolve: 0, courage: 0 },
  lethalTempoStacks: 0,
  lethalTempoUntil: 0,
  triggeredVirtueEffects: 0
});

export const willbenderState = defineProfessionSpecializationState('Willbender', createWillbenderState);
