/** Canonical Core elementalist skill definitions grouped by their GW2 owner. */
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistSkill } from '#gw2/professions/elementalist/types.js';

/**
 * Catalog definitions for the four attunement profession skills.
 *
 * They are instant, castable alongside another skill, and carry no cooldown
 * here: swap behavior and attunement recharge belong to the attunement
 * mechanics rather than to this data.
 */
export const ELEMENTALIST_PROFESSION_SKILLS_SKILL_MECHANICS: Readonly<
  Record<number, SkillDefinition<ElementalistSkill>>
> = {
  [ID.FIRE_ATTUNEMENT]: {
    name: 'Fire Attunement',
    icon: 'https://render.guildwars2.com/file/1C91E9C799469ACC6EAF1ACD4B0AD8ACAB0C69A2/103035.png',
    inputCategory: 'bar-swap',
    // Explicit weapon or profession bar replacement.
    type: 'Profession',
    slot: 'Profession_1',

    cooldown: 0,
    skillFamily: 'Attunement',
    castTimeMs: 0,
    canCastConcurrently: true,
    effects: []
  },
  [ID.WATER_ATTUNEMENT]: {
    name: 'Water Attunement',
    icon: 'https://render.guildwars2.com/file/737E1B9F7855B9F5D3DE1C990CD42118EF3D1C92/102820.png',
    inputCategory: 'bar-swap',
    // Explicit weapon or profession bar replacement.
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 0,
    skillFamily: 'Attunement',
    castTimeMs: 0,
    canCastConcurrently: true,
    effects: []
  },
  [ID.AIR_ATTUNEMENT]: {
    name: 'Air Attunement',
    icon: 'https://render.guildwars2.com/file/4857F59020DE3B0950B9C91F3D234A1C1932984A/103048.png',
    inputCategory: 'bar-swap',
    // Explicit weapon or profession bar replacement.
    type: 'Profession',
    slot: 'Profession_3',

    cooldown: 0,
    skillFamily: 'Attunement',
    castTimeMs: 0,
    canCastConcurrently: true,
    effects: []
  },
  [ID.EARTH_ATTUNEMENT]: {
    name: 'Earth Attunement',
    icon: 'https://render.guildwars2.com/file/4B8056D9BD080DC8E74AE6A57B2B383A2D4265C9/102870.png',
    inputCategory: 'bar-swap',
    // Explicit weapon or profession bar replacement.
    type: 'Profession',
    slot: 'Profession_4',

    cooldown: 0,
    skillFamily: 'Attunement',
    castTimeMs: 0,
    canCastConcurrently: true,
    effects: []
  }
};
