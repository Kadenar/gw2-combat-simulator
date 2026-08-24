import type { HeraldState } from '../../types.js';
import { defineProfessionSpecializationState } from '../../../../platform/engine/profession/state.js';

export const HERALD_PUBLIC_END_STATE_KEYS: readonly (keyof HeraldState)[] = Object.freeze([]);
export const HERALD_PUBLIC_INACTIVE_STATE_DEFAULTS: Readonly<Partial<HeraldState>> = Object.freeze({});

// Keep Herald ICDs private so threshold re-entry and rapid boon packets cannot reset either trait's cadence.
export function createHeraldState(): HeraldState {
  return {
    elevatedCompassionReadyAt: 0,
    sharedEmpowermentReadyAt: 0
  };
}

// The same factory is used for both scheduler and resolver state (see module.ts) because Herald needs no resolver-only state.
export const heraldState = defineProfessionSpecializationState('Herald', createHeraldState);
