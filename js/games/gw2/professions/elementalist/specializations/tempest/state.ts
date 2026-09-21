import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';

/** Per-run Tempest state: only the Latent Stamina internal-cooldown stamp is specialization-owned. */
export interface TempestState {
  latentStaminaReadyAt: number;
}

/** Declares the 'Tempest' specialization state slot plus its typed accessor for hooks and traits. */
export const tempestState = defineProfessionSpecializationState('Tempest', (): TempestState => ({
  latentStaminaReadyAt: 0
}));
