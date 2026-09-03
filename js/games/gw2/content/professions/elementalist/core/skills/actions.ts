/**
 * Owns declarative simulator-only Elementalist actions.
 * Bundle equip state and endurance spending remain with their persistent mechanics.
 */
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/content/professions/elementalist/data/ids.js';
import type { Skill, SkillFragment } from '#gw2/platform/engine/types.js';

/** Dodge is a fixed-duration rotation action; execution spends endurance after its cast. */
export const ELEMENTALIST_CORE_ACTION_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.DODGE]: {
    name: 'Dodge',
    type: 'Action',
    slot: 'Action',
    categories: ['Dodge'],
    castTimeMs: 800,
    unaffectedByQuickness: true,
    cooldown: 0,
    skillFamily: 'Dodge',
    effects: []
  }
});

const CONJURE_ACTION_ICONS = Object.freeze({
  'Frost Bow': 'https://render.guildwars2.com/file/CC6D556B7C3F95C49E54D697CC2B4E79105DC594/103348.png',
  'Lightning Hammer': 'https://render.guildwars2.com/file/C3DA6AC980062B0A0EEA14CE51393748CFAE01CA/103369.png',
  'Fiery Greatsword': 'https://render.guildwars2.com/file/EEDA0B1847077DE93DBB0575D44BE0615FBCE728/103328.png'
});

/** Supplies bundle controls absent from the API catalog so rotations can drop and recover conjures. */
export const ELEMENTALIST_CORE_ACTION_EXTRA_SKILLS: readonly Skill[] = Object.freeze([
  {
    id: ID.DROP_BUNDLE,
    name: '__drop_bundle',
    displayName: 'Drop Bundle',
    description: 'Drop the currently equipped conjured weapon.',
    icon: 'https://wiki.guildwars2.com/images/c/ce/Weapon_Swap_Button.png',
    type: 'Action',
    weapon: '',
    slot: 'Action',
    specialization: '',
    categories: ['Bundle'],
    cooldown: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null,
    castTimeMs: 0,
    simulatorExcluded: false,
    paletteAction: false,
    effects: []
  },
  ...[
    ['Frost Bow', ID.PICK_UP_FROST_BOW],
    ['Lightning Hammer', ID.PICK_UP_LIGHTNING_HAMMER],
    ['Fiery Greatsword', ID.PICK_UP_FIERY_GREATSWORD]
  ].map(([weapon, id]): Skill => ({
    id: Number(id),
    name: `__pickup_${weapon}`,
    displayName: `Pick up ${weapon}`,
    description: `Pick up the available ${weapon}.`,
    icon: CONJURE_ACTION_ICONS[weapon as keyof typeof CONJURE_ACTION_ICONS],
    type: 'Action',
    weapon: '',
    slot: 'Action',
    specialization: '',
    categories: ['Bundle'],
    cooldown: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null,
    castTimeMs: 300,
    unaffectedByQuickness: true,
    simulatorExcluded: false,
    paletteAction: false,
    effects: []
  }))
]);
