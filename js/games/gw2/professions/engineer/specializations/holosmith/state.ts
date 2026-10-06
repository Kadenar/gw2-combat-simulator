import { grantCharges, type ChargeGrant } from '#gw2/platform/combat/resources/charges.js';
import {
  defineProfessionSpecializationState,
  definePublicStateDefaults
} from '#gw2/platform/profession-definition/state.js';
import { createResourceClock } from '#gw2/platform/combat/resources/clock.js';
import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';

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

// Detached defaults describe the observations exposed while Holosmith is active.
export const HOLOSMITH_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
  heat: createResourceClock(),
  photonForgeActive: false,
  forgeExitedAt: null,
  overheated: false,
  kitLockoutUntil: 0
} satisfies Partial<HolosmithState>);

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
