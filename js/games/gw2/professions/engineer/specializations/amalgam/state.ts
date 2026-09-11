import type { AmalgamState, EngineerConfig } from '#gw2/professions/engineer/types.js';
import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';

/** Keeps legacy Evolve commands and both API IDs on the one action selected by Double Helix. */
export function resolveAmalgamSkillId(traits: unknown, skillId: SkillId): SkillId {
  if (
    ![ID.EVOLVE_BASE, ID.EVOLVE_DOUBLE_HELIX].includes(Number(skillId)) &&
    !['Evolve', 'Evolve (Base)', 'Evolve (Double Helix)'].includes(String(skillId))
  )
    return skillId;
  return hasTrait(traits, TRAIT.DOUBLE_HELIX) ? ID.EVOLVE_DOUBLE_HELIX : ID.EVOLVE_BASE;
}

// Amalgam owns its public protocol state and the inactive compatibility values.
export const AMALGAM_PUBLIC_END_STATE_KEYS = Object.freeze([
  'selectedMorphSkillIds',
  'evolvedUntil',
  'willingHostUntil',
  'plasmaticStateUntil',
  'rapaciousUntil',
  'predatorUntil',
  'titanicUntil',
  'berserkerUntil'
] as const satisfies readonly (keyof AmalgamState)[]);

export const AMALGAM_PUBLIC_INACTIVE_STATE_DEFAULTS: Readonly<Partial<AmalgamState>> = Object.freeze({
  selectedMorphSkillIds: [],
  evolvedUntil: 0,
  willingHostUntil: 0,
  plasmaticStateUntil: 0,
  rapaciousUntil: 0,
  predatorUntil: 0,
  titanicUntil: 0,
  berserkerUntil: 0
});

/** Creates an isolated Amalgam protocol and strain state from the selected morph configuration. */
export function createAmalgamState(config: EngineerConfig = {}): AmalgamState {
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
