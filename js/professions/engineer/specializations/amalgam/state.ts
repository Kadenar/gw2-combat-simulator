import type { AmalgamState, EngineerConfig } from "../../types.js";
import { defineProfessionSpecializationState } from "../../../../platform/engine/profession.js";

export function createAmalgamState(config: EngineerConfig = {}): AmalgamState {
  return {
    // IDs for the three selected Morph (F2/F3/F4) protocol skills.
    selectedMorphSkillIds: [...(config.selectedMorphSkillIds || [])],
    // Timestamp-until fields: each tracks when a strain/state buff expires.
    // Resolved by comparing event.at against the stored value.
    evolvedUntil: 0,       // set by Evolve
    willingHostUntil: 0,   // set by any morph cast (Willing Host trait)
    plasmaticStateUntil: 0, // set by Plasmatic State cast
    thornsUntil: 0,        // Thorns morph — enables Thorns Retaliation damage
    rapaciousUntil: 0,     // Rapacious Strain (Thorns silver-lining strain)
    predatorUntil: 0,      // Predator Strain (Shred silver-lining strain)
    titanicUntil: 0,       // Titanic Strain (Obliterate silver-lining strain) — boosts might scaling
    berserkerUntil: 0,     // Berserker Strain (Demolish silver-lining strain)
    activeStances: {},
  };
}

export const amalgamState = defineProfessionSpecializationState(
  "Amalgam",
  createAmalgamState,
);
