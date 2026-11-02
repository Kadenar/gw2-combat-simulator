import { purgeExpiredStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import {
  defineProfessionSpecializationState,
  type SpecializationRuntimeState
} from '#gw2/platform/profession-definition/state.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';

export interface SpellbreakerState {
  attackerInsightExpiries: number[];
  magebaneTetherUntil: number;
}

function createSpellbreakerState(): SpellbreakerState {
  return {
    // Array of individual expiry timestamps rather than a stack count so each
    // stack can expire independently at the time it was gained.
    attackerInsightExpiries: [],
    magebaneTetherUntil: 0
  };
}

export const spellbreakerState = defineProfessionSpecializationState('Spellbreaker', createSpellbreakerState);

/** Filter public expiry values without mutating live deadlines; the observer detaches the result. */
export function projectSpellbreakerPlanningState(input: Gw2PlanningStateInput<SpecializationRuntimeState>) {
  const state = spellbreakerState.from(input.profession);

  return {
    [STATE.ATTACKER_INSIGHT_EXPIRIES]: purgeExpiredStacks(state.attackerInsightExpiries, input.time),
    [STATE.MAGEBANE_TETHER_UNTIL]: state.magebaneTetherUntil > input.time ? state.magebaneTetherUntil : 0
  };
}
