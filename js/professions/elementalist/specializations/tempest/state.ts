import { defineProfessionSpecializationState } from '../../../../platform/engine/profession/state.js';

export interface TempestState {
  latentStaminaReadyAt: number;
}

export const tempestState = defineProfessionSpecializationState('Tempest', (): TempestState => ({
  latentStaminaReadyAt: 0
}));

export const TEMPEST_PUBLIC_END_STATE_KEYS = Object.freeze([] as const);

export const TEMPEST_PUBLIC_INACTIVE_STATE_DEFAULTS: Readonly<Partial<TempestState>> = Object.freeze({});

export const createTempestState = tempestState.create;
