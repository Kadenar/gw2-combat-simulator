/**
 * Literal lookup tables shared by Core Elementalist mechanics.
 *
 * Skill-id keyed maps let cast, availability, and presentation code classify a
 * skill by its element or mechanic without inspecting catalog text. Numeric
 * defaults here are the fallbacks used whenever a balance profile omits the
 * corresponding field.
 *
 * This module holds data only; it must not import mechanics.
 */
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/content/professions/elementalist/data/ids.js';
import type { ElementalistAttunement } from '#gw2/content/professions/elementalist/core/state.js';

/** Default recharge stamped on the attunement the player just left. */
export const ATTUNEMENT_RECHARGE_SECONDS = 10;
/** Default lockout applied to the attunements not involved in a swap. */
export const OFF_ATTUNEMENT_RECHARGE_SECONDS = 1.5;
/** Endurance one dodge spends; also the profile fallback for dodge availability. */
export const DODGE_ENDURANCE_COST = 50;
/** Baseline endurance regeneration used when projecting dodge availability. */
export const ENDURANCE_PER_SECOND = 5;
/** Hammer skills that create an orb, mapped to the element whose orb slot they occupy. */
export const HAMMER_ORB_SKILLS: Readonly<Record<number, ElementalistAttunement>> = Object.freeze({
  [ID.FLAME_WHEEL]: 'Fire',
  [ID.ICY_COIL]: 'Water',
  [ID.CRESCENT_WIND]: 'Air',
  [ID.ROCKY_LOOP]: 'Earth'
});
/** Pistol skills that interact with stocked bullets, mapped to the bullet element they use. */
export const PISTOL_SKILL_ELEMENTS: Readonly<Record<number, ElementalistAttunement>> = Object.freeze({
  [ID.RAGING_RICOCHET]: 'Fire',
  [ID.FRIGID_FLURRY]: 'Water',
  [ID.DAZING_DISCHARGE]: 'Air',
  [ID.SHATTERING_STONE]: 'Earth',
  [ID.SEARING_SALVO]: 'Fire',
  [ID.FROZEN_FUSILLADE]: 'Water',
  [ID.AERIAL_AGILITY]: 'Air',
  [ID.AERIAL_AGILITY_CHAIN]: 'Air',
  [ID.AERIAL_AGILITY_DASH]: 'Air',
  [ID.BOULDER_BLAST]: 'Earth'
});
/** Pistol skills that read their element without spending the stocked bullet. */
export const PISTOL_NO_CONSUME = new Set<number>([ID.AERIAL_AGILITY, ID.AERIAL_AGILITY_CHAIN, ID.AERIAL_AGILITY_DASH]);
/** Pistol chain links that must never stock a new bullet of their element. */
export const PISTOL_NO_GRANT = new Set<number>([ID.AERIAL_AGILITY_CHAIN, ID.AERIAL_AGILITY_DASH]);
/** Fire-field skills whose field duration and tick packets Persisting Flames extends. */
export const PERSISTING_FLAMES_FIELD_SKILLS = new Set([
  'Lava Font',
  'Pyroclastic Blast',
  'Burning Retreat',
  'Burning Speed',
  'Flamewall',
  'Wildfire',
  'Flame Uprising',
  'Ring of Fire'
]);
/** Conjure utility skills, mapped to the bundle weapon they equip. */
export const CONJURE_SKILLS: Readonly<Record<number, string>> = Object.freeze({
  [ID.CONJURE_FROST_BOW]: 'Frost Bow',
  [ID.CONJURE_LIGHTNING_HAMMER]: 'Lightning Hammer',
  [ID.CONJURE_FIERY_GREATSWORD]: 'Fiery Greatsword'
});
/** Bundle weapon names, used to detect that a conjure is currently wielded. */
export const CONJURED_WEAPONS = new Set(Object.values(CONJURE_SKILLS));
/** Transmute skills, mapped to the aura they consume. */
export const AURA_TRANSMUTE_SKILLS: Readonly<Record<number, string>> = Object.freeze({
  [ID.TRANSMUTE_FROST]: 'Frost Aura',
  [ID.TRANSMUTE_LIGHTNING]: 'Shocking Aura',
  [ID.TRANSMUTE_EARTH]: 'Magnetic Aura',
  [ID.TRANSMUTE_FIRE]: 'Fire Aura'
});
/** Spear etching progressions: the etching skill and its lesser/full payoff stages that share slot 5. */
export const ETCHING_CHAINS = Object.freeze([
  {
    etching: 'Etching: Volcano',
    lesser: 'Lesser Volcano',
    full: 'Volcano'
  },
  {
    etching: 'Etching: Jökulhlaup',
    lesser: 'Lesser Jökulhlaup',
    full: 'Jökulhlaup'
  },
  {
    etching: 'Etching: Derecho',
    lesser: 'Lesser Derecho',
    full: 'Derecho'
  },
  {
    etching: 'Etching: Haboob',
    lesser: 'Lesser Haboob',
    full: 'Haboob'
  }
] as const);
