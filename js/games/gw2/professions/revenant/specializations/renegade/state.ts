import type { RevenantTimedStack } from '#gw2/professions/revenant/types.js';
import type { ChargeGrant } from '#gw2/platform/combat/resources/charges.js';
import {
  definePublicStateDefaults,
  defineProfessionSpecializationState
} from '#gw2/platform/profession-definition/state.js';

export interface RenegadeState {
  bandTogether: ChargeGrant;
  kallasFervor: RevenantTimedStack[];
  kallasFervorMaximumStacks: number;
  razorclawsRage: ChargeGrant;

  /** Deadline for Brutal Momentum's Vigor reaction to applied Fury. */
}

export const RENEGADE_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
  bandTogether: { charges: 0, expiresAt: 0 },
  kallasFervor: [],
  razorclawsRage: {
    charges: 0,
    expiresAt: 0,
    readyAt: 0
  }
} satisfies Partial<RenegadeState>);

function createRenegadeState(): RenegadeState {
  return {
    // A finite replacement grant empowers exactly one eligible summon accepted before expiry.
    bandTogether: { charges: 0, expiresAt: 0 },
    // each element records the application timestamp and expiry; the array is pruned lazily
    kallasFervor: [],
    // synchronized from the active patchable Kalla's Fervor profile
    kallasFervorMaximumStacks: 5,
    razorclawsRage: {
      charges: 0,
      expiresAt: 0,
      // readyAt enforces the per-hit internal cooldown between Razorclaw bleeds
      readyAt: 0
    }
  };
}

export const renegadeState = defineProfessionSpecializationState('Renegade', createRenegadeState);
