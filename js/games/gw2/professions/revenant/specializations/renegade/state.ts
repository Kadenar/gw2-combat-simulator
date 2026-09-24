import type { RevenantTimedStack } from '#gw2/professions/revenant/types.js';
import type { ChargeGrant } from '#gw2/platform/combat/resources/charges.js';
import {
  definePublicStateDefaults,
  defineProfessionSpecializationState
} from '#gw2/platform/engine/profession/state.js';

export interface RenegadeState {
  bandTogetherReady: boolean;
  bandTogetherExpiresAt: number;
  kallasFervor: RevenantTimedStack[];
  kallasFervorMaximumStacks: number;
  razorclawsRage: ChargeGrant;
  endlessEnmityReadyAt: number;
  bloodFuryReadyAt: number;
  /** Scheduler-owned deadline for Brutal Momentum's Vigor reaction. */
  brutalMomentumReadyAt: number;
  soulcleaveReadyAt: number;
}

export const RENEGADE_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
  bandTogetherReady: false,
  bandTogetherExpiresAt: 0,
  kallasFervor: [],
  razorclawsRage: {
    charges: 0,
    expiresAt: 0,
    readyAt: 0
  }
} satisfies Partial<RenegadeState>);

export function createRenegadeState(): RenegadeState {
  return {
    // bandTogetherReady + bandTogetherExpiresAt together form the one-use enhancement window; both must be checked because the flag alone doesn't expire itself
    bandTogetherReady: false,
    bandTogetherExpiresAt: 0,
    // each element records the application timestamp and expiry; the array is pruned lazily
    kallasFervor: [],
    // synchronized from the active patchable Kalla's Fervor profile
    kallasFervorMaximumStacks: 5,
    razorclawsRage: {
      charges: 0,
      expiresAt: 0,
      // readyAt enforces the per-hit internal cooldown between Razorclaw bleeds
      readyAt: 0
    },
    endlessEnmityReadyAt: 0,
    bloodFuryReadyAt: 0,
    brutalMomentumReadyAt: 0,
    soulcleaveReadyAt: 0
  };
}

export const renegadeState = defineProfessionSpecializationState('Renegade', createRenegadeState);
