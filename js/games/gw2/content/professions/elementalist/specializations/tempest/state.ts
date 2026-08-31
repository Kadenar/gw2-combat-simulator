import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';

/** Per-run Tempest state: only the Latent Stamina internal-cooldown stamp is specialization-owned. */
export interface TempestState {
  latentStaminaReadyAt: number;
}

/** Declares the 'Tempest' specialization state slot plus its typed accessor for hooks and traits. */
export const tempestState = defineProfessionSpecializationState('Tempest', (): TempestState => ({
  latentStaminaReadyAt: 0
}));

// Tempest exposes no state in the public end-of-run projection; both fragments stay empty so
// the family aggregate in elementalist/state.ts can spread them uniformly with the other specs.
export const TEMPEST_PUBLIC_END_STATE_KEYS = Object.freeze([] as const);

export const TEMPEST_PUBLIC_INACTIVE_STATE_DEFAULTS: Readonly<Partial<TempestState>> = Object.freeze({});

/** Factory the module registers for both the scheduler and resolver state trees. */
export const createTempestState = tempestState.create;
