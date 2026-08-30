import { ENGINEER_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { defineProfessionSpecializationState } from '../../../../../platform/engine/profession/state.js';
import { hasTrait } from '../../../../../platform/combat/state/traits.js';
import { selectedEngineerTraits } from '../../core/state.js';
import { HOLOSMITH_HEAT } from './mechanics/constants.js';
import type { EngineerConfig, HolosmithState } from '../../types.js';

// Holosmith owns both its public projection keys and the inactive compatibility values.
export const HOLOSMITH_PUBLIC_END_STATE_KEYS = Object.freeze([
  'heat',
  'maximumHeat',
  'photonForgeActive',
  'forgeExitedAt',
  'overheated',
  'solarFocusingLensStacks',
  'solarFocusingLensReadyAt',
  'solarFocusingLensUntil',
  'kitLockoutUntil'
] as const satisfies readonly (keyof HolosmithState)[]);

export const HOLOSMITH_PUBLIC_INACTIVE_STATE_DEFAULTS: Readonly<Partial<HolosmithState>> = Object.freeze({
  heat: 0,
  maximumHeat: 100,
  photonForgeActive: false,
  forgeExitedAt: null,
  overheated: false,
  solarFocusingLensStacks: 0,
  solarFocusingLensReadyAt: 0,
  solarFocusingLensUntil: 0,
  kitLockoutUntil: 0
});

export function createHolosmithState(config: EngineerConfig = {}): HolosmithState {
  const traits = selectedEngineerTraits(config);
  // Resource capacity is structural Holosmith state, not patchable balance data.
  const maximumHeat = hasTrait(traits, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT)
    ? HOLOSMITH_HEAT.enhancedCapacityMaximum
    : HOLOSMITH_HEAT.baseMaximum;
  const initialHeat = Math.min(maximumHeat, Math.max(0, Number(config.initialHeat || 0)));
  return {
    heat: initialHeat,
    maximumHeat,
    heatUpdatedAt: 0,
    passiveHeatAt: null,
    photonForgeActive: false,
    // null = forge has never been exited (no cooling yet); 0 = treat as exited at t=0 so
    // the passive cooling schedule starts immediately when initialHeat > 0.
    forgeExitedAt: initialHeat > 0 ? 0 : null,
    overheated: false,
    solarFocusingLensStacks: 0,
    solarFocusingLensReadyAt: 0,
    solarFocusingLensUntil: 0,
    enhancedCapacityMightReadyAt: null,
    kitLockoutUntil: 0
  };
}

export const holosmithState = defineProfessionSpecializationState('Holosmith', createHolosmithState);
