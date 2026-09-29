import {
  defineProfessionSpecializationState,
  definePublicStateDefaults
} from '#gw2/platform/engine/profession/state.js';
import type { EngineerConfig } from '#gw2/professions/engineer/types.js';

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

// Amalgam owns its public protocol state and the inactive compatibility values.
export const AMALGAM_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
  selectedMorphSkillIds: [],
  evolvedUntil: 0,
  willingHostUntil: 0,
  plasmaticStateUntil: 0,
  rapaciousUntil: 0,
  predatorUntil: 0,
  titanicUntil: 0,
  berserkerUntil: 0
} satisfies Partial<AmalgamState>);

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
