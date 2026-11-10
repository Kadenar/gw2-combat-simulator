import { createResourceClock } from '#gw2/platform/combat/resources/clock.js';
import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import { ENDURANCE } from '#gw2/platform/combat/resources/endurance-rules.js';
import {
  defineProfessionSpecializationState,
  type SpecializationRuntimeState
} from '#gw2/platform/profession-definition/state.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import { projectTroubadourInstruments } from '#gw2/professions/mesmer/specializations/troubadour/mechanics/instrument-windows.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';

export interface MesmerTroubadourState {
  notes: ResourceClock;
  endurance: ResourceClock;
  instruments: Record<string, number>;
  lastInstrument: string;
}

/** Starts Troubadour resources with no instrument performance carried into the simulation. */
function createTroubadourState(): MesmerTroubadourState {
  return {
    notes: createResourceClock(),
    endurance: createResourceClock(ENDURANCE.maximum),
    instruments: {},
    lastInstrument: ''
  };
}

export const troubadourState = defineProfessionSpecializationState('Troubadour', createTroubadourState);

/** Select public clocks and derive active instrument names and remaining time for the status display. */
export function projectTroubadourPlanningState(input: Gw2PlanningStateInput<SpecializationRuntimeState>) {
  const state = troubadourState.from(input.profession);
  return {
    [STATE.ENDURANCE]: state.endurance,
    [STATE.NOTES]: state.notes,
    [STATE.ACTIVE_INSTRUMENTS]: projectTroubadourInstruments(state.instruments, input.time)
  };
}
