import type { ActivationClaims } from '#gw2/platform/combat/procs/activation-claims.js';
import { defineProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';

export interface SoulbeastState {
  beastmodeActive: boolean;
  oneWolfPackUntil: number;

  soulbeastActivationClaims: ActivationClaims;
}

export function createSoulbeastState(): SoulbeastState {
  return {
    // Soulbeast starts merged — the rotation begins in Beastmode by default.
    beastmodeActive: true,
    oneWolfPackUntil: 0,

    // Tracks per-activation-id whether the beast-ability first-hit proc already fired, preventing multi-hit skills from triggering trait effects more than once per cast.
    soulbeastActivationClaims: {}
  };
}

export const soulbeastState = defineProfessionSpecializationState('Soulbeast', createSoulbeastState);

/** Publish detached, typed observations from this module's owner under stable public IDs. */
export function projectSoulbeastPlanningState(input: Gw2PlanningStateInput) {
  const state = soulbeastState.from(input);
  return structuredClone({
    [STATE.BEASTMODE_ACTIVE]: state.beastmodeActive,
    [STATE.ONE_WOLF_PACK_UNTIL]: state.oneWolfPackUntil
  });
}
