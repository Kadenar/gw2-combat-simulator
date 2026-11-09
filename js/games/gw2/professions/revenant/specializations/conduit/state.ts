import type { RechargeProgress } from '#gw2/platform/combat/recharge.js';
import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import { createResourceClock } from '#gw2/platform/combat/resources/clock.js';
import {
  defineProfessionSpecializationState,
  type SpecializationRuntimeState
} from '#gw2/platform/profession-definition/state.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';

export interface ConduitState {
  affinity: ResourceClock;
  cosmicWisdomUntil: number;
  conduitForm: string;
  beguilingHazeCharges: number;
  beguilingHazeReadyAt: number;
  /** Main recharge saved while follow-ups occupy the button; null means no recharge remains. */
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

/** Select public fields without mutating their owner; the planning observer detaches the result. */
export function projectConduitPlanningState(input: Gw2PlanningStateInput<SpecializationRuntimeState>) {
  const state = conduitState.from(input.profession);
  return {
    [STATE.AFFINITY]: state.affinity,
    [STATE.COSMIC_WISDOM_UNTIL]: state.cosmicWisdomUntil,
    [STATE.CONDUIT_FORM]: state.conduitForm,
    [STATE.BEGUILING_HAZE_CHARGES]: state.beguilingHazeCharges,
    [STATE.BEGUILING_HAZE_READY_AT]: state.beguilingHazeReadyAt
  };
}
