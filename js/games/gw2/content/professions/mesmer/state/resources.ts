import { readProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import type { SchedulerState } from '#gw2/platform/engine/types.js';

import type { MesmerRuntimeState } from '#gw2/content/professions/mesmer/state/types.js';

interface MesmerNumericResourceState {
  numericResource: number;
}

/** Returns the active numeric resource state and rejects clone-owning Mesmer specializations. */
export function mesmerNumericResourceState(state: SchedulerState<MesmerRuntimeState>): MesmerNumericResourceState {
  const kind = state.profession.specialization.kind;
  const active = readProfessionSpecializationState<MesmerNumericResourceState>(state.profession, kind);
  if (typeof active?.numericResource !== 'number') {
    throw new TypeError(`${kind} does not own a numeric Mesmer resource.`);
  }

  return active as MesmerNumericResourceState;
}
