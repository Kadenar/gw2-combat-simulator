import type { AmalgamState, EngineerConfig } from '../../types.js';
import { defineProfessionSpecializationState } from '../../../../platform/engine/profession.js';

// Amalgam owns its public protocol state and the inactive compatibility values.
export const AMALGAM_PUBLIC_END_STATE_KEYS = Object.freeze([
  'selectedMorphSkillIds',
  'evolvedUntil',
  'willingHostUntil',
  'plasmaticStateUntil',
  'thornsUntil',
  'rapaciousUntil',
  'predatorUntil',
  'titanicUntil',
  'berserkerUntil',
  'activeStances'
] as const satisfies readonly (keyof AmalgamState)[]);

export const AMALGAM_PUBLIC_INACTIVE_STATE_DEFAULTS: Readonly<Partial<AmalgamState>> = Object.freeze({
  selectedMorphSkillIds: [],
  evolvedUntil: 0,
  willingHostUntil: 0,
  plasmaticStateUntil: 0,
  thornsUntil: 0,
  rapaciousUntil: 0,
  predatorUntil: 0,
  titanicUntil: 0,
  berserkerUntil: 0,
  activeStances: {}
});

export function createAmalgamState(config: EngineerConfig = {}): AmalgamState {
  return {
    // IDs for the three selected Morph (F2/F3/F4) protocol skills.
    selectedMorphSkillIds: [...(config.selectedMorphSkillIds || [])],
    // Timestamp-until fields: each tracks when a strain/state buff expires.
    // Resolved by comparing event.at against the stored value.
    evolvedUntil: 0, // set by Evolve
    willingHostUntil: 0, // set by any morph cast (Willing Host trait)
    plasmaticStateUntil: 0, // set by Plasmatic State cast
    thornsUntil: 0, // Thorns morph — enables Thorns Retaliation damage
    rapaciousUntil: 0, // Rapacious Strain (Thorns silver-lining strain)
    predatorUntil: 0, // Predator Strain (Shred silver-lining strain)
    titanicUntil: 0, // Titanic Strain (Obliterate silver-lining strain) — boosts might scaling
    berserkerUntil: 0, // Berserker Strain (Demolish silver-lining strain)
    activeStances: {}
  };
}

export const amalgamState = defineProfessionSpecializationState('Amalgam', createAmalgamState);
