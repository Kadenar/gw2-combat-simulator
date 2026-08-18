import { ELEMENTALIST_SKILL_IDS as ID } from './ids.js';

/**
 * Connects attunement-specific simulator actions to the stable GW2 loadout
 * skill selected by build-template palette IDs.
 */
export const ELEMENTALIST_LOADOUT_SKILL_IDS: ReadonlyMap<number, number> = new Map([
  [ID.GLYPH_OF_ELEMENTAL_HARMONY, 5569],
  [ID.GLYPH_OF_ELEMENTAL_POWER_FIRE, 5506],
  [ID.GLYPH_OF_ELEMENTAL_POWER_WATER, 5506],
  [ID.GLYPH_OF_ELEMENTAL_POWER_AIR, 5506],
  [ID.GLYPH_OF_ELEMENTAL_POWER_EARTH, 5506],
  [ID.GLYPH_OF_STORMS_FIRE, 5734],
  [ID.GLYPH_OF_STORMS_WATER, 5734],
  [ID.GLYPH_OF_STORMS_AIR, 5734],
  [ID.GLYPH_OF_STORMS_EARTH, 5734],
  [ID.PRIMORDIAL_STANCE_FIRE, 40183],
  [ID.PRIMORDIAL_STANCE_WATER, 40183],
  [ID.PRIMORDIAL_STANCE_AIR, 40183],
  [ID.PRIMORDIAL_STANCE_EARTH, 40183],
  [ID.GLYPH_OF_ELEMENTALS, 5666],
  [ID.GLYPH_OF_ELEMENTALS_EARTH, 5666]
]);

/**
 * Supplies an API metadata source for simulator-only projections that cannot
 * use the same positive ID without colliding in the canonical catalog.
 */
export const ELEMENTALIST_API_SKILL_ID_OVERRIDES: ReadonlyMap<number, number> = new Map([
  [ID.PRIMORDIAL_STANCE_WATER, 40183],
  [ID.PRIMORDIAL_STANCE_AIR, 40183],
  [ID.PRIMORDIAL_STANCE_EARTH, 40183],
  [ID.AERIAL_AGILITY_CHAIN, 71857]
]);
