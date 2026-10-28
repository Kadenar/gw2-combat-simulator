import { defineProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';

export interface BerserkerState {
  /** Null is inactive; the expiry task clears finite windows and previews may hold Infinity. */
  berserkUntil: number | null;
  fireAuraUntil: number;

  /** Actual completed activations let delayed hits react without reading action history. */
  completedActivations: Record<string, number>;
}

// Aura and proc deadlines are shared by the chronological Berserker reactions.
function createBerserkerState(): BerserkerState {
  return {
    berserkUntil: null,
    // Aura acquisition, consumption, and expiry share this current window.
    fireAuraUntil: 0,

    completedActivations: {}
  };
}

export const berserkerState = defineProfessionSpecializationState('Berserker', createBerserkerState);

/** Publish detached, typed observations from this module's owner under stable public IDs. */
export function projectBerserkerPlanningState(input: Gw2PlanningStateInput) {
  const state = berserkerState.from(input);
  return structuredClone({
    [STATE.BERSERK_UNTIL]: state.berserkUntil
  });
}
