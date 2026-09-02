/** Core Elementalist skill mechanics. */
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/content/professions/elementalist/data/ids.js';
import type { Skill, SkillFragment } from '#gw2/platform/engine/types.js';
import { ELEMENTALIST_CORE_DAGGER_SKILL_MECHANICS } from '#gw2/content/professions/elementalist/core/skills/weapons/dagger.js';
import { ELEMENTALIST_CORE_FOCUS_SKILL_MECHANICS } from '#gw2/content/professions/elementalist/core/skills/weapons/focus.js';
import { ELEMENTALIST_CORE_HAMMER_SKILL_MECHANICS } from '#gw2/content/professions/elementalist/core/skills/weapons/hammer.js';
import { ELEMENTALIST_CORE_PISTOL_SKILL_MECHANICS } from '#gw2/content/professions/elementalist/core/skills/weapons/pistol.js';
import { ELEMENTALIST_CORE_SCEPTER_SKILL_MECHANICS } from '#gw2/content/professions/elementalist/core/skills/weapons/scepter.js';
import { ELEMENTALIST_CORE_SPEAR_SKILL_MECHANICS } from '#gw2/content/professions/elementalist/core/skills/weapons/spear.js';
import { ELEMENTALIST_CORE_STAFF_SKILL_MECHANICS } from '#gw2/content/professions/elementalist/core/skills/weapons/staff.js';
import { ELEMENTALIST_CORE_SWORD_SKILL_MECHANICS } from '#gw2/content/professions/elementalist/core/skills/weapons/sword.js';
import { ELEMENTALIST_CORE_WARHORN_SKILL_MECHANICS } from '#gw2/content/professions/elementalist/core/skills/weapons/warhorn.js';
import { ELEMENTALIST_MISC_SKILLS_SKILL_MECHANICS } from '#gw2/content/professions/elementalist/core/skills/misc-skills.js';
import { ELEMENTALIST_PROFESSION_SKILLS_SKILL_MECHANICS } from '#gw2/content/professions/elementalist/core/skills/profession-skills.js';
import { ELEMENTALIST_SLOT_SKILLS_SKILL_MECHANICS } from '#gw2/content/professions/elementalist/core/skills/slot-skills.js';

/**
 * Composes physical-weapon fragments with Core attunements, utilities, conjures, and synthetic actions.
 *
 * Keyed by skill id and handed to the catalog by the Core module, so every API
 * skill entry picks up the simulator-authored mechanics for its family.
 */
export const ELEMENTALIST_CORE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  ...ELEMENTALIST_MISC_SKILLS_SKILL_MECHANICS,
  ...ELEMENTALIST_PROFESSION_SKILLS_SKILL_MECHANICS,
  ...ELEMENTALIST_SLOT_SKILLS_SKILL_MECHANICS,
  ...ELEMENTALIST_CORE_DAGGER_SKILL_MECHANICS,
  ...ELEMENTALIST_CORE_FOCUS_SKILL_MECHANICS,
  ...ELEMENTALIST_CORE_HAMMER_SKILL_MECHANICS,
  ...ELEMENTALIST_CORE_PISTOL_SKILL_MECHANICS,
  ...ELEMENTALIST_CORE_SCEPTER_SKILL_MECHANICS,
  ...ELEMENTALIST_CORE_SPEAR_SKILL_MECHANICS,
  ...ELEMENTALIST_CORE_STAFF_SKILL_MECHANICS,
  ...ELEMENTALIST_CORE_SWORD_SKILL_MECHANICS,
  ...ELEMENTALIST_CORE_WARHORN_SKILL_MECHANICS
});

// Icons for the synthetic pick-up actions synthesized below, one per conjured weapon.
const CONJURE_ACTION_ICONS = Object.freeze({
  'Frost Bow': 'https://render.guildwars2.com/file/CC6D556B7C3F95C49E54D697CC2B4E79105DC594/103348.png',
  'Lightning Hammer': 'https://render.guildwars2.com/file/C3DA6AC980062B0A0EEA14CE51393748CFAE01CA/103369.png',
  'Fiery Greatsword': 'https://render.guildwars2.com/file/EEDA0B1847077DE93DBB0575D44BE0615FBCE728/103328.png'
});

/**
 * Skills the simulator needs that the API catalog does not publish: the two
 * Glyph of Elementals command flipovers plus the bundle drop and pick-up
 * actions a rotation uses to swap conjured weapons.
 */
export const ELEMENTALIST_CORE_EXTRA_SKILLS: readonly Skill[] = Object.freeze([
  {
    id: ID.FLAME_BARRAGE_ELEMENTAL_COMMAND,
    name: 'Flame Barrage',
    displayName: 'Flame Barrage',
    description: 'Command your summoned Fire Elemental to unleash a flame barrage.',
    icon: 'https://render.guildwars2.com/file/64A5054179704B60614F90964DE1FB3D39AEC972/867446.png',
    type: 'Elite',
    weapon: '',
    slot: 'Elite',
    specialization: '',
    categories: ['Glyph', 'Elemental command'],
    cooldown: 15,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null,
    flipParentId: ID.GLYPH_OF_ELEMENTALS,
    flipParent: 'Glyph of Elementals',
    castTimeMs: 0,
    slotSelectable: false,
    simulatorExcluded: false,
    effects: []
  },
  {
    id: ID.STOMP_ELEMENTAL_COMMAND,
    name: 'Stomp',
    displayName: 'Stomp',
    description:
      'Command your summoned Earth Elemental to stomp, granting Protection to allies and crippling and immobilizing nearby foes.',
    icon: 'https://render.guildwars2.com/file/A39EBFA9E241DDBF6EEFBEC515192F32F5F2A620/867445.png',
    type: 'Elite',
    weapon: '',
    slot: 'Elite',
    specialization: '',
    categories: ['Glyph', 'Elemental command'],
    cooldown: 18,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null,
    flipParentId: ID.GLYPH_OF_ELEMENTALS_EARTH,
    flipParent: 'Glyph of Elementals (Earth)',
    castTimeMs: 0,
    slotSelectable: false,
    simulatorExcluded: false,
    effects: []
  },
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
