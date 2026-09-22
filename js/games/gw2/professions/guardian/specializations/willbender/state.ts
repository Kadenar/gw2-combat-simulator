import {
  definePublicStateDefaults,
  defineProfessionSpecializationState
} from '#gw2/platform/engine/profession/state.js';
import type { GuardianVirtue } from '#gw2/professions/guardian/types.js';

export interface GuardianWillbenderState {
  flameVirtue: GuardianVirtue | null;
  pendingWeaponCooldownReduction: Record<string, number>;
  justiceUntil: number;
  resolveUntil: number;
  courageUntil: number;
  virtueHitCounts: Record<'justice' | 'resolve' | 'courage', number>;
  lethalTempoStacks: number;
  lethalTempoUntil: number;
  triggeredVirtueEffects: number;
}

export function createWillbenderState(): GuardianWillbenderState {
  return {
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
export const WILLBENDER_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
  flameVirtue: null,
  justiceUntil: 0,
  resolveUntil: 0,
  courageUntil: 0,
  virtueHitCounts: { justice: 0, resolve: 0, courage: 0 },
  lethalTempoStacks: 0,
  lethalTempoUntil: 0,
  triggeredVirtueEffects: 0
} satisfies Partial<GuardianWillbenderState>);

export const willbenderState = defineProfessionSpecializationState('Willbender', createWillbenderState);
