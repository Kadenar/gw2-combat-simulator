import { defineProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';
import type { RechargeProgress } from '#gw2/platform/combat/recharge.js';
import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import { createResourceClock } from '#gw2/platform/combat/resources/clock.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';

export interface ConduitState {
  affinity: ResourceClock;
  cosmicWisdomUntil: number;
  conduitForm: string;
  beguilingHazeCharges: number;
  beguilingHazeReadyAt: number;
  beguilingHazeRecharge: RechargeProgress | null;
}

export function revenantConduitFormIsActive(
  state: Partial<ConduitState> | null | undefined,
  form: string,
  at = 0
): boolean {
  return state?.conduitForm === form && (state.cosmicWisdomUntil || 0) > (at || 0);
}

/** The selected resource policy initializes affinity; form and recharge lifetimes stay with Conduit. */
function createConduitState(): ConduitState {
  return {
    affinity: createResourceClock(),
    cosmicWisdomUntil: 0,
    // Empty string means no active form; presence is tested via revenantConduitFormIsActive, not a separate boolean.
    conduitForm: '',
    beguilingHazeCharges: 0,
    beguilingHazeReadyAt: 0,
    beguilingHazeRecharge: null
  };
}

export const conduitState = defineProfessionSpecializationState('Conduit', createConduitState);

/** Publish detached, typed observations from this module's owner under stable public IDs. */
export function projectConduitPlanningState(input: Gw2PlanningStateInput) {
  const state = conduitState.from(input);
  return structuredClone({
    [STATE.AFFINITY]: state.affinity,
    [STATE.COSMIC_WISDOM_UNTIL]: state.cosmicWisdomUntil,
    [STATE.CONDUIT_FORM]: state.conduitForm,
    [STATE.BEGUILING_HAZE_CHARGES]: state.beguilingHazeCharges,
    [STATE.BEGUILING_HAZE_READY_AT]: state.beguilingHazeReadyAt
  });
}
