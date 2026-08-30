import type { Skill } from '../../../../../platform/engine/types.js';

// Keep the imported Weapon Stow action visually distinct in the simulator timeline.
const WEAPON_STOW_ICON = new URL('../../../../../../../../assets/warrior/weapon-stow.png', import.meta.url).href;

export const WARRIOR_WEAPON_STOW: Skill = Object.freeze({
  id: -6,
  name: 'Weapon Stow',
  description: 'Stow the active weapon and occupy one action frame.',
  icon: WEAPON_STOW_ICON,
  type: 'Action',
  weapon: '',
  slot: 'Action',
  specialization: '',
  categories: [],
  cooldown: 0,
  ammo: 0,
  ammoRecharge: 0,
  nextChainId: null,
  flipSkillId: null,
  castTimeMs: 80,
  unaffectedByQuickness: true,
  interruptCommitMs: 0,
  implemented: true,
  simulatorExcluded: false,
  effects: []
});

export const WARRIOR_DODGE: Skill = Object.freeze({
  id: -5,
  name: 'Dodge',
  description: 'Perform a dodge roll.',
  icon: 'https://wiki.guildwars2.com/images/b/b2/Dodge.png',
  type: 'Action',
  weapon: '',
  slot: 'Action',
  specialization: '',
  categories: [],
  cooldown: 0,
  ammo: 0,
  ammoRecharge: 0,
  nextChainId: null,
  flipSkillId: null,
  castTimeMs: 800,
  unaffectedByQuickness: true,
  rechargeAnchor: 'castStart',
  implemented: true,
  simulatorExcluded: false,
  handlerId: 'warrior.dodge',
  effects: []
});

export const WARRIOR_SWAP_WEAPONS: Skill = Object.freeze({
  id: -3,
  name: 'Swap Weapons',
  description: 'Swap to the other equipped weapon set.',
  icon: '',
  type: 'Action',
  weapon: '',
  slot: 'Action',
  specialization: '',
  categories: [],
  cooldown: 5,
  ammo: 0,
  ammoRecharge: 0,
  nextChainId: null,
  flipSkillId: null,
  castTimeMs: 0,
  rechargeAnchor: 'castStart',
  implemented: true,
  simulatorExcluded: false,
  handlerId: 'warrior.weapon-swap',
  effects: []
});
