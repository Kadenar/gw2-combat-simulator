import { ELEMENTALIST_SKILL_IDS as ID } from '../data/ids.js';
import type { ElementalistAttunement } from './state.js';

export const ATTUNEMENT_RECHARGE_SECONDS = 10;
export const OFF_ATTUNEMENT_RECHARGE_SECONDS = 1.5;
export const DUAL_ATTUNEMENT_RECHARGE_SECONDS = 4;
export const DODGE_ENDURANCE_COST = 50;
export const ENDURANCE_PER_SECOND = 5;
// Skills that keep the active weapon-1 autoattack chain progressing instead of
// resetting it (e.g. movement/utility casts the game treats as chain-neutral).
export const AUTOATTACK_CHAIN_PRESERVING_SKILL_IDS = new Set<number>([
  ID.RIDE_THE_LIGHTNING,
  ID.RELENTLESS_FIRE,
  ID.WEAVE_SELF
]);

export const HAMMER_ORB_SKILLS: Readonly<Record<number, ElementalistAttunement>> = Object.freeze({
  [ID.FLAME_WHEEL]: 'Fire',
  [ID.ICY_COIL]: 'Water',
  [ID.CRESCENT_WIND]: 'Air',
  [ID.ROCKY_LOOP]: 'Earth'
});
export const HAMMER_DUAL_ORB_SKILLS: Readonly<Record<number, readonly ElementalistAttunement[]>> = Object.freeze({
  [ID.DUAL_ORBITS_FIRE_AND_WATER]: ['Fire', 'Water'],
  [ID.DUAL_ORBITS_FIRE_AND_AIR]: ['Fire', 'Air'],
  [ID.DUAL_ORBITS_FIRE_AND_EARTH]: ['Fire', 'Earth'],
  [ID.DUAL_ORBITS_WATER_AND_AIR]: ['Water', 'Air'],
  [ID.DUAL_ORBITS_WATER_AND_EARTH]: ['Water', 'Earth'],
  [ID.DUAL_ORBITS_AIR_AND_EARTH]: ['Air', 'Earth']
});
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
export const PISTOL_DUAL_ELEMENTS: Readonly<Record<number, readonly ElementalistAttunement[]>> = Object.freeze({
  [ID.FROSTFIRE_FLURRY]: ['Fire', 'Water'],
  [ID.PURBLINDING_PLASMA]: ['Fire', 'Air'],
  [ID.MOLTEN_METEOR]: ['Fire', 'Earth'],
  [ID.FLOWING_FINESSE]: ['Water', 'Air'],
  [ID.ECHOING_EROSION]: ['Water', 'Earth'],
  [ID.ENERVATING_EARTH]: ['Air', 'Earth']
});
export const PISTOL_NO_CONSUME = new Set<number>([ID.AERIAL_AGILITY, ID.AERIAL_AGILITY_CHAIN, ID.AERIAL_AGILITY_DASH]);
export const PISTOL_NO_GRANT = new Set<number>([ID.AERIAL_AGILITY_CHAIN, ID.AERIAL_AGILITY_DASH]);
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
export const CONJURE_SKILLS: Readonly<Record<number, string>> = Object.freeze({
  [ID.CONJURE_FROST_BOW]: 'Frost Bow',
  [ID.CONJURE_LIGHTNING_HAMMER]: 'Lightning Hammer',
  [ID.CONJURE_FIERY_GREATSWORD]: 'Fiery Greatsword'
});
export const CONJURED_WEAPONS = new Set(Object.values(CONJURE_SKILLS));
export const AURA_TRANSMUTE_SKILLS: Readonly<Record<number, string>> = Object.freeze({
  [ID.TRANSMUTE_FROST]: 'Frost Aura',
  [ID.TRANSMUTE_LIGHTNING]: 'Shocking Aura',
  [ID.TRANSMUTE_EARTH]: 'Magnetic Aura',
  [ID.TRANSMUTE_FIRE]: 'Fire Aura'
});
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
export const FULL_ETCHING_CHARGE_SKILLS = new Set<number>([ID.OVERLOAD_FIRE, ID.OVERLOAD_AIR, ID.OVERLOAD_EARTH]);
export const BOON_KINDS = new Set([
  'aegis',
  'alacrity',
  'fury',
  'might',
  'protection',
  'quickness',
  'regeneration',
  'resistance',
  'resolution',
  'stability',
  'superspeed',
  'swiftness',
  'vigor'
]);
