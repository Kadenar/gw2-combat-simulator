import type { ChargeGrant } from '#gw2/platform/combat/resources/charges.js';
import { defineProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import type { RevenantTimedStack } from '#gw2/professions/revenant/types.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';

export interface RenegadeState {
  kallasFervor: RevenantTimedStack[];
  razorclawsRage: ChargeGrant;
  /** Each assumed ally's own Razorclaw grant, keyed by ally index; the allied controller supplies only strikes. */
  alliedRazorclawsRage: Record<number, ChargeGrant>;
}

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

/** Publish detached, typed observations from this module's owner under stable public IDs. */
export function projectRenegadePlanningState(input: Gw2PlanningStateInput) {
  const state = renegadeState.from(input);
  return structuredClone({
    [STATE.KALLAS_FERVOR]: state.kallasFervor,
    [STATE.RAZORCLAWS_RAGE]: state.razorclawsRage
  });
}
