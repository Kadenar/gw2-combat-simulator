import { purgeExpiredStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import {
  flattenProfessionState,
  projectPublicProfessionState,
  definePublicStateDefaults,
  defineProfessionSpecializationState
} from '#gw2/platform/profession-definition/state.js';

export interface SpellbreakerState {
  attackerInsightExpiries: number[];
  magebaneTetherUntil: number;
}

/** Declares Spellbreaker's public fields and inactive values. */
const SPELLBREAKER_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
  attackerInsightExpiries: [],
  magebaneTetherUntil: 0
} satisfies Partial<SpellbreakerState>);

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
  const state = projectPublicProfessionState(
    flattenProfessionState(input.profession) as unknown as SpellbreakerState,
    SPELLBREAKER_PUBLIC_STATE_PROJECTION.keys,
    SPELLBREAKER_PUBLIC_STATE_PROJECTION.defaults
  );
  state.attackerInsightExpiries = purgeExpiredStacks(state.attackerInsightExpiries, input.time);

  if (state.magebaneTetherUntil <= input.time) state.magebaneTetherUntil = 0;

  return state;
}
