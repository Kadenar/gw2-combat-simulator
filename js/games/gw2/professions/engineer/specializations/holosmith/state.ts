import { grantCharges, type ChargeGrant } from '#gw2/platform/combat/resources/charges.js';
import { defineProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';
import { createResourceClock } from '#gw2/platform/combat/resources/clock.js';
import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';

export interface HolosmithState {
  heat: ResourceClock;
  passiveHeatAt: number | null;
  enhancedCapacityMightAt: number;
  photonForgeActive: boolean;
  forgeExitedAt: number | null;
  overheated: boolean;
  solarFocusingLens: ChargeGrant;
  kitLockoutUntil: number;
}

/** Creates the Forge lifecycle; the resource policy initializes heat before cooling starts. */
export function createHolosmithState(): HolosmithState {
  return {
    heat: createResourceClock(),
    passiveHeatAt: null,
    enhancedCapacityMightAt: Infinity,
    photonForgeActive: false,
    // Initialization supplies an exit anchor only when the selected pool starts preheated.
    forgeExitedAt: null,
    overheated: false,
    solarFocusingLens: grantCharges(0, 0),
    kitLockoutUntil: 0
  };
}

export const holosmithState = defineProfessionSpecializationState('Holosmith', createHolosmithState);

/** Publish detached, typed observations from this module's owner under stable public IDs. */
export function projectHolosmithPlanningState(input: Gw2PlanningStateInput) {
  const state = holosmithState.from(input);
  return structuredClone({
    [STATE.HEAT]: state.heat,
    [STATE.PHOTON_FORGE_ACTIVE]: state.photonForgeActive,
    [STATE.FORGE_EXITED_AT]: state.forgeExitedAt,
    [STATE.OVERHEATED]: state.overheated,
    [STATE.KIT_LOCKOUT_UNTIL]: state.kitLockoutUntil
  });
}
