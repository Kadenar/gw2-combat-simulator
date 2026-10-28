import { purgeExpiredStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import { cloneStateFields, defineProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';
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

/** Detach public fields before filtering expiry so observations cannot mutate live deadlines. */
export function projectSpellbreakerPlanningState(input: Gw2PlanningStateInput) {
  const state = cloneStateFields(spellbreakerState.from(input), ['attackerInsightExpiries', 'magebaneTetherUntil']);
  state.attackerInsightExpiries = purgeExpiredStacks(state.attackerInsightExpiries, input.time);

  if (state.magebaneTetherUntil <= input.time) state.magebaneTetherUntil = 0;

  return {
    [STATE.ATTACKER_INSIGHT_EXPIRIES]: state.attackerInsightExpiries,
    [STATE.MAGEBANE_TETHER_UNTIL]: state.magebaneTetherUntil
  };
}
