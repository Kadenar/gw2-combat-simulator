import type { HeraldState } from '../../types.js';
import { defineProfessionSpecializationState } from '../../../../platform/engine/profession/state.js';

export const HERALD_PUBLIC_END_STATE_KEYS: readonly (keyof HeraldState)[] = Object.freeze([]);
export const HERALD_PUBLIC_INACTIVE_STATE_DEFAULTS: Readonly<Partial<HeraldState>> = Object.freeze({});

// Herald carries no private simulation state beyond what the shared core (activeUpkeeps, availableFlips, energy) already tracks.
export function createHeraldState(): HeraldState {
  return {};
}

// The same factory is used for both scheduler and resolver state (see module.ts) because Herald needs no resolver-only state.
export const heraldState = defineProfessionSpecializationState('Herald', createHeraldState);
