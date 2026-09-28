/**
 * Literal lookup tables shared by Core Elementalist mechanics.
 *
 * Skill-id keyed maps let cast, availability, and presentation code classify a
 * skill by its element or mechanic without inspecting catalog text.
 *
 * This module holds data only; it must not import mechanics.
 */
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';

/** Hammer skills that create an orb, mapped to the element whose orb slot they occupy. */
export const HAMMER_ORB_SKILLS: Readonly<Record<number, ElementalistAttunement>> = Object.freeze({
  [ID.FLAME_WHEEL]: 'Fire',
  [ID.ICY_COIL]: 'Water',
  [ID.CRESCENT_WIND]: 'Air',
  [ID.ROCKY_LOOP]: 'Earth'
});
/** Conjure utility skills, mapped to the bundle weapon they equip. */
export const CONJURE_SKILLS: Readonly<Record<number, string>> = Object.freeze({
  [ID.CONJURE_FROST_BOW]: 'Frost Bow',
  [ID.CONJURE_LIGHTNING_HAMMER]: 'Lightning Hammer',
  [ID.CONJURE_FIERY_GREATSWORD]: 'Fiery Greatsword'
});
/** Synthetic pickup actions, keyed by stable action ID rather than their protocol label. */
export const CONJURE_PICKUP_WEAPONS: Readonly<Record<number, string>> = Object.freeze({
  [ID.PICK_UP_FROST_BOW]: 'Frost Bow',
  [ID.PICK_UP_LIGHTNING_HAMMER]: 'Lightning Hammer',
  [ID.PICK_UP_FIERY_GREATSWORD]: 'Fiery Greatsword'
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
    etchingId: ID.ETCHING_VOLCANO,
    lesserId: ID.LESSER_VOLCANO,
    fullId: ID.VOLCANO,
    etching: 'Etching: Volcano',
    lesser: 'Lesser Volcano',
    full: 'Volcano'
  },
  {
    etchingId: ID.ETCHING_JO_KULHLAUP,
    lesserId: ID.LESSER_JO_KULHLAUP,
    fullId: ID.JO_KULHLAUP,
    etching: 'Etching: Jökulhlaup',
    lesser: 'Lesser Jökulhlaup',
    full: 'Jökulhlaup'
  },
  {
    etchingId: ID.ETCHING_DERECHO,
    lesserId: ID.LESSER_DERECHO,
    fullId: ID.DERECHO,
    etching: 'Etching: Derecho',
    lesser: 'Lesser Derecho',
    full: 'Derecho'
  },
  {
    etchingId: ID.ETCHING_HABOOB,
    lesserId: ID.LESSER_HABOOB,
    fullId: ID.HABOOB,
    etching: 'Etching: Haboob',
    lesser: 'Lesser Haboob',
    full: 'Haboob'
  }
] as const);
