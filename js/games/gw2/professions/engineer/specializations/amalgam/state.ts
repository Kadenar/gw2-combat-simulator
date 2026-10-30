import { defineProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import type { EngineerConfig } from '#gw2/professions/engineer/types.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';

export interface AmalgamState {
  selectedMorphSkillIds: number[];
  evolvedUntil: number;
  willingHostUntil: number;
  plasmaticStateUntil: number;
  rapaciousUntil: number;
  predatorUntil: number;
  titanicUntil: number;
  berserkerUntil: number;
}

/** Creates an isolated Amalgam protocol and strain state from the selected morph configuration. */
function createAmalgamState(config: EngineerConfig = {}): AmalgamState {
  return {
    // IDs for the three selected Morph (F2/F3/F4) protocol skills.
    selectedMorphSkillIds: [...(config.selectedMorphSkillIds || [])],
    // Timestamp-until fields: each tracks when a strain/state buff expires.
    // Resolved by comparing event.at against the stored value.
    evolvedUntil: 0, // set by Evolve
    willingHostUntil: 0, // set by any morph cast (Willing Host trait)
    plasmaticStateUntil: 0, // set by Plasmatic State cast
    rapaciousUntil: 0, // Rapacious Strain (Thorns silver-lining strain)
    predatorUntil: 0, // Predator Strain (Shred silver-lining strain)
    titanicUntil: 0, // Titanic Strain (Obliterate silver-lining strain) — boosts might scaling
    berserkerUntil: 0 // Berserker Strain (Demolish silver-lining strain)
  };
}

export const amalgamState = defineProfessionSpecializationState('Amalgam', createAmalgamState);

/** Publish detached, typed observations from this module's owner under stable public IDs. */
export function projectAmalgamPlanningState(input: Gw2PlanningStateInput) {
  const state = amalgamState.from(input);
  return structuredClone({
    [STATE.SELECTED_MORPH_SKILL_IDS]: state.selectedMorphSkillIds,
    [STATE.EVOLVED_UNTIL]: state.evolvedUntil,
    [STATE.PLASMATIC_STATE_UNTIL]: state.plasmaticStateUntil,
    [STATE.RAPACIOUS_UNTIL]: state.rapaciousUntil,
    [STATE.PREDATOR_UNTIL]: state.predatorUntil,
    [STATE.TITANIC_UNTIL]: state.titanicUntil,
    [STATE.BERSERKER_UNTIL]: state.berserkerUntil
  });
}
