import type { ActivationClaims } from '#gw2/platform/combat/procs/activation-claims.js';
import {
  defineProfessionSpecializationState,
  type SpecializationRuntimeState
} from '#gw2/platform/profession-definition/state.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';

export interface SoulbeastState {
  beastmodeActive: boolean;

  soulbeastActivationClaims: ActivationClaims;
}

export function createSoulbeastState(): SoulbeastState {
  return {
    // Soulbeast starts merged - the rotation begins in Beastmode by default.
    beastmodeActive: true,

    // Tracks per-activation-id whether the beast-ability first-hit proc already fired, preventing multi-hit skills from triggering trait effects more than once per cast.
    soulbeastActivationClaims: {}
  };
}

export const soulbeastState = defineProfessionSpecializationState('Soulbeast', createSoulbeastState);

/** Select public fields without mutating their owner; the planning observer detaches the result. */
export function projectSoulbeastPlanningState(input: Gw2PlanningStateInput<SpecializationRuntimeState>) {
  const state = soulbeastState.from(input.profession);
  return {
    [STATE.BEASTMODE_ACTIVE]: state.beastmodeActive
  };
}
