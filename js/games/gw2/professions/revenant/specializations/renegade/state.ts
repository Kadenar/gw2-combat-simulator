import type { RevenantTimedStack } from '#gw2/professions/revenant/types.js';
import type { ChargeGrant } from '#gw2/platform/combat/resources/charges.js';
import {
  definePublicStateDefaults,
  defineProfessionSpecializationState
} from '#gw2/platform/profession-definition/state.js';

export interface RenegadeState {
  kallasFervor: RevenantTimedStack[];
  razorclawsRage: ChargeGrant;
  /** Each assumed ally's own Razorclaw grant, keyed by ally index; the allied controller supplies only strikes. */
  alliedRazorclawsRage: Record<number, ChargeGrant>;
}

export const RENEGADE_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
  kallasFervor: [],
  razorclawsRage: {
    charges: 0,
    expiresAt: 0,
    readyAt: 0
  }
} satisfies Partial<RenegadeState>);

function createRenegadeState(): RenegadeState {
  return {
    // each element records the application timestamp and expiry; the array is pruned lazily
    kallasFervor: [],
    razorclawsRage: {
      charges: 0,
      expiresAt: 0,
      // readyAt enforces the per-hit internal cooldown between Razorclaw bleeds
      readyAt: 0
    },
    alliedRazorclawsRage: {}
  };
}

export const renegadeState = defineProfessionSpecializationState('Renegade', createRenegadeState);
