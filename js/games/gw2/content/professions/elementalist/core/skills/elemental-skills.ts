/**
 * Owns supplemental command skills for Glyph of Elementals summons.
 * Summon lifecycle and attack execution live in `mechanics/elementals/`.
 */
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/content/professions/elementalist/data/ids.js';
import type { Skill } from '#gw2/platform/engine/types.js';

/** Supplies command flipovers absent from the API catalog for active Fire and Earth elementals. */
export const ELEMENTALIST_CORE_ELEMENTAL_EXTRA_SKILLS: readonly Skill[] = Object.freeze([
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
  }
]);
