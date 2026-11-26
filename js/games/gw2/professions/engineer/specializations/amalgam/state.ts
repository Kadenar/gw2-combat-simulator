import type { ProfessionBalanceContext } from '#gw2/platform/profession-definition/balance-context.js';
import {
  defineProfessionSpecializationState,
  type SpecializationRuntimeState
} from '#gw2/platform/profession-definition/state.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import { distinctAmalgamMorphs } from '#gw2/professions/engineer/specializations/amalgam/selection-policy.js';
import type { EngineerConfig } from '#gw2/professions/engineer/types.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';

export interface AmalgamState {
  selectedMorphSkillIds: number[];
  evolvedUntil: number;
  willingHostUntil: number;
  plasmaticStateUntil: number;
  resiliantUntil: number;
  replicatingUntil: number;
  rapaciousUntil: number;
  predatorUntil: number;
  titanicUntil: number;
  berserkerUntil: number;
}

/** Creates an isolated Amalgam protocol and strain state from the selected morph configuration. */
function createAmalgamState(
  config: EngineerConfig,
  { balanceContext }: { balanceContext: ProfessionBalanceContext }
): AmalgamState {
  const selectedMorphSkillIds = [...(config.selectedMorphSkillIds ?? [])];

  if (!distinctAmalgamMorphs(balanceContext.catalog, selectedMorphSkillIds))
    throw new TypeError('Amalgam requires a distinct protocol in each equipped slot.');

  return {
    // IDs for the three selected Morph (F2/F3/F4) protocol skills.
    selectedMorphSkillIds,
    // Timestamp-until fields: each tracks when a strain/state buff expires.
    // Resolved by comparing event.at against the stored value.
    evolvedUntil: 0, // set by Evolve
    willingHostUntil: 0, // set by any morph cast (Willing Host trait)
    plasmaticStateUntil: 0, // set by Plasmatic State cast
    rapaciousUntil: 0, // Rapacious Strain (Thorns silver-lining strain)
    titanicUntil: 0, // Titanic Strain, Obliterate's Silver Lining strain, increases Might scaling.
    // These four deadlines supply only the inspector countdown for each strain's own boon grant.
    resiliantUntil: 0, // Resistance
    replicatingUntil: 0, // Alacrity
    predatorUntil: 0, // Quickness
    berserkerUntil: 0 // Stability
  };
}

export const amalgamState = defineProfessionSpecializationState('Amalgam', createAmalgamState);

/** Select public fields without mutating their owner; the planning observer detaches the result. */
export function projectAmalgamPlanningState(input: Gw2PlanningStateInput<SpecializationRuntimeState>) {
  const state = amalgamState.from(input.profession);
  return {
    [STATE.SELECTED_MORPH_SKILL_IDS]: state.selectedMorphSkillIds,
    [STATE.EVOLVED_UNTIL]: state.evolvedUntil,
    [STATE.PLASMATIC_STATE_UNTIL]: state.plasmaticStateUntil,
    [STATE.RESILIANT_UNTIL]: state.resiliantUntil,
    [STATE.REPLICATING_UNTIL]: state.replicatingUntil,
    [STATE.RAPACIOUS_UNTIL]: state.rapaciousUntil,
    [STATE.PREDATOR_UNTIL]: state.predatorUntil,
    [STATE.TITANIC_UNTIL]: state.titanicUntil,
    [STATE.BERSERKER_UNTIL]: state.berserkerUntil
  };
}
