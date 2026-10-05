import { defineProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';

/** Allied Lightning Jolt charges belong to Tempest and cannot outlive their elemental generation. */
export interface TempestState {
  pendingLightningJolt: { summonGeneration: number; coefficient: number; skillId: number } | null;
}

/** Declares the 'Tempest' specialization state slot plus its typed accessor for hooks and traits. */
export const tempestState = defineProfessionSpecializationState('Tempest', (): TempestState => ({
  pendingLightningJolt: null
}));
