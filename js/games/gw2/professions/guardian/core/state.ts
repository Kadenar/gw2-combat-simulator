import { activeChargeCount, grantCharges, type ChargeGrant } from '#gw2/platform/combat/resources/charges.js';
import { createResourceClock } from '#gw2/platform/combat/resources/clock.js';
import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import { ENDURANCE } from '#gw2/platform/combat/resources/endurance-rules.js';
import { purgeExpiredStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';

export interface GuardianCoreState {
  endurance: ResourceClock;
  justiceActiveArmed: boolean;
  justiceHitCount: number;
  symbolicAvengerExpirations: number[];
  symbolIgnitionStartsAt: number;
  symbolIgnitionUntil: number;

  resolutionUntil: number;
  righteousInstinctsGeneration: number;
  righteousInstinctsCause: Gw2ResolverEvent | null;

  spearIlluminated: ChargeGrant;
  spearLuminanceUntil: number;
}

// Create a complete Guardian core state with bounded resources and initialized
// virtue, trait, and symbol bookkeeping.
export function createGuardianCoreState(): GuardianCoreState {
  return {
    endurance: createResourceClock(ENDURANCE.maximum),
    justiceActiveArmed: false,
    justiceHitCount: 0,
    symbolicAvengerExpirations: [],
    symbolIgnitionStartsAt: -1,
    symbolIgnitionUntil: -1,

    resolutionUntil: 0,
    righteousInstinctsGeneration: 0,
    righteousInstinctsCause: null,

    spearIlluminated: grantCharges(0, 0),
    spearLuminanceUntil: 0
  };
}

/** Each Symbolic Avenger stack expires independently, including between symbol hits. */
export function activeSymbolicAvengerExpirations(state: Partial<GuardianCoreState>, at: number): number[] {
  return purgeExpiredStacks(state.symbolicAvengerExpirations || [], at);
}

/** Derive visible windows without mutating grants or reading private state; the observer detaches the result. */
export function projectGuardianPlanningState(input: Gw2PlanningStateInput) {
  const state = (input.profession as { core: ReturnType<typeof createGuardianCoreState> }).core;
  // Project only live entitlement without consuming the runtime's captured grant.
  return {
    [STATE.ENDURANCE]: state.endurance,
    [STATE.JUSTICE_ACTIVE_ARMED]: state.justiceActiveArmed,
    [STATE.SYMBOLIC_AVENGER_EXPIRATIONS]: activeSymbolicAvengerExpirations(state, input.time),
    [STATE.RESOLUTION_UNTIL]: state.resolutionUntil,
    [STATE.SPEAR_ILLUMINATED]: {
      ...state.spearIlluminated,
      charges: activeChargeCount(state.spearIlluminated, input.time)
    },
    [STATE.SPEAR_LUMINANCE_UNTIL]: state.spearLuminanceUntil
  };
}
