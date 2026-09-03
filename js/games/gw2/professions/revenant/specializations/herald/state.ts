import type { HeraldState } from '#gw2/professions/revenant/types.js';
import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';

// Keep Herald ICDs private so threshold re-entry and rapid boon packets cannot reset either trait's cadence.
export function createHeraldState(): HeraldState {
  return {
    elevatedCompassionReadyAt: 0,
    sharedEmpowermentReadyAt: 0
  };
}

// The same factory is used for both scheduler and resolver state (see module.ts) because Herald needs no resolver-only state.
export const heraldState = defineProfessionSpecializationState('Herald', createHeraldState);
