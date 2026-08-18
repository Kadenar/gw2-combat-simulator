import type { ElementalistAttunement } from './state.js';

export const ATTUNEMENT_RECHARGE_SECONDS = 10;
export const OFF_ATTUNEMENT_RECHARGE_SECONDS = 1.5;
export const DUAL_ATTUNEMENT_RECHARGE_SECONDS = 4;
export const DODGE_ENDURANCE_COST = 50;
export const ENDURANCE_PER_SECOND = 5;
export const AUTOATTACK_CHAIN_PRESERVING_SKILLS = new Set(['Ride the Lightning', 'Relentless Fire', 'Weave Self']);

export const HAMMER_ORB_SKILLS: Readonly<Record<string, ElementalistAttunement>> = Object.freeze({
  'Flame Wheel': 'Fire',
  'Icy Coil': 'Water',
  'Crescent Wind': 'Air',
  'Rocky Loop': 'Earth'
});
export const HAMMER_DUAL_ORB_SKILLS: Readonly<Record<string, readonly ElementalistAttunement[]>> = Object.freeze({
  'Dual Orbits: Fire and Water': ['Fire', 'Water'],
  'Dual Orbits: Fire and Air': ['Fire', 'Air'],
  'Dual Orbits: Fire and Earth': ['Fire', 'Earth'],
  'Dual Orbits: Water and Air': ['Water', 'Air'],
  'Dual Orbits: Water and Earth': ['Water', 'Earth'],
  'Dual Orbits: Air and Earth': ['Air', 'Earth']
});
export const PISTOL_SKILL_ELEMENTS: Readonly<Record<string, ElementalistAttunement>> = Object.freeze({
  'Raging Ricochet': 'Fire',
  'Frigid Flurry': 'Water',
  'Dazing Discharge': 'Air',
  'Shattering Stone': 'Earth',
  'Searing Salvo': 'Fire',
  'Frozen Fusillade': 'Water',
  'Aerial Agility': 'Air',
  'Aerial Agility (chain)': 'Air',
  'Aerial Agility (dash)': 'Air',
  'Boulder Blast': 'Earth'
});
export const PISTOL_DUAL_ELEMENTS: Readonly<Record<string, readonly ElementalistAttunement[]>> = Object.freeze({
  'Frostfire Flurry': ['Fire', 'Water'],
  'Purblinding Plasma': ['Fire', 'Air'],
  'Molten Meteor': ['Fire', 'Earth'],
  'Flowing Finesse': ['Water', 'Air'],
  'Echoing Erosion': ['Water', 'Earth'],
  'Enervating Earth': ['Air', 'Earth']
});
export const PISTOL_NO_CONSUME = new Set(['Aerial Agility', 'Aerial Agility (chain)', 'Aerial Agility (dash)']);
export const PISTOL_NO_GRANT = new Set(['Aerial Agility (chain)', 'Aerial Agility (dash)']);
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
export const CONJURE_SKILLS: Readonly<Record<string, string>> = Object.freeze({
  'Conjure Frost Bow': 'Frost Bow',
  'Conjure Lightning Hammer': 'Lightning Hammer',
  'Conjure Fiery Greatsword': 'Fiery Greatsword'
});
export const CONJURED_WEAPONS = new Set(Object.values(CONJURE_SKILLS));
export const AURA_TRANSMUTE_SKILLS: Readonly<Record<string, string>> = Object.freeze({
  'Transmute Frost': 'Frost Aura',
  'Transmute Lightning': 'Shocking Aura',
  'Transmute Earth': 'Magnetic Aura',
  'Transmute Fire': 'Fire Aura'
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
export const FULL_ETCHING_CHARGE_SKILLS = new Set(['Overload Fire', 'Overload Air', 'Overload Earth']);
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
