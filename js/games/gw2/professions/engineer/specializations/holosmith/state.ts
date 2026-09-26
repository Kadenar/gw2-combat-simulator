import { grantCharges, type ChargeGrant } from '#gw2/platform/combat/resources/charges.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import {
  definePublicStateDefaults,
  defineProfessionSpecializationState
} from '#gw2/platform/engine/profession/state.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { selectedEngineerTraits } from '#gw2/professions/engineer/core/state.js';
import { HOLOSMITH_HEAT } from '#gw2/professions/engineer/specializations/holosmith/mechanics/constants.js';
import type { EngineerConfig } from '#gw2/professions/engineer/types.js';
import { boundedNumber } from '#kernel/core/numeric.js';

export interface HolosmithState {
  heat: number;
  maximumHeat: number;
  heatUpdatedAt: number;
  passiveHeatAt: number | null;
  enhancedCapacityMightAt: number;
  photonForgeActive: boolean;
  forgeExitedAt: number | null;
  overheated: boolean;
  solarFocusingLens: ChargeGrant;
  kitLockoutUntil: number;
}

// Holosmith owns both its public projection keys and the inactive display values.
export const HOLOSMITH_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
  heat: 0,
  maximumHeat: 100,
  photonForgeActive: false,
  forgeExitedAt: null,
  overheated: false,
  kitLockoutUntil: 0
} satisfies Partial<HolosmithState>);

/** Creates isolated Holosmith heat, Forge, trait-charge, and lockout state from a build configuration. */
export function createHolosmithState(config: EngineerConfig = {}): HolosmithState {
  const traits = selectedEngineerTraits(config);
  // Resource capacity is structural Holosmith state, not patchable balance data.
  const maximumHeat = hasTrait(traits, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT)
    ? HOLOSMITH_HEAT.enhancedCapacityMaximum
    : HOLOSMITH_HEAT.baseMaximum;
  const initialHeat = boundedNumber(config.initialHeat, 0, 0, maximumHeat);
  return {
    heat: initialHeat,
    maximumHeat,
    heatUpdatedAt: 0,
    passiveHeatAt: null,
    enhancedCapacityMightAt: Infinity,
    photonForgeActive: false,
    // null = forge has never been exited (no cooling yet); 0 = treat as exited at t=0 so
    // the passive cooling schedule starts immediately when initialHeat > 0.
    forgeExitedAt: initialHeat > 0 ? 0 : null,
    overheated: false,
    solarFocusingLens: grantCharges(0, 0),
    kitLockoutUntil: 0
  };
}

export const holosmithState = defineProfessionSpecializationState('Holosmith', createHolosmithState);
