/** Canonical Core elementalist skill fragments grouped by their GW2 owner. */
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

/**
 * Catalog fragments for the four attunement profession skills.
 *
 * They are instant, castable alongside another skill, and carry no cooldown
 * here: swap behavior and attunement recharge belong to the attunement
 * mechanics rather than to this data.
 */
export const ELEMENTALIST_PROFESSION_SKILLS_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.FIRE_ATTUNEMENT]: {
    inputCategory: 'bar-swap', // Explicit weapon or profession bar replacement.
    name: 'Fire Attunement',
    type: 'Profession',
    slot: 'Profession_1',
    mechanicSlot: 1,
    categories: ['Attunement'],
    castTimeMs: 0,
    cooldown: 0,
    canCastConcurrently: true,
    skillFamily: 'Attunement',
    effects: []
  },
  [ID.WATER_ATTUNEMENT]: {
    inputCategory: 'bar-swap', // Explicit weapon or profession bar replacement.
    name: 'Water Attunement',
    type: 'Profession',
    slot: 'Profession_2',
    mechanicSlot: 2,
    categories: ['Attunement'],
    castTimeMs: 0,
    cooldown: 0,
    canCastConcurrently: true,
    skillFamily: 'Attunement',
    effects: []
  },
  [ID.AIR_ATTUNEMENT]: {
    inputCategory: 'bar-swap', // Explicit weapon or profession bar replacement.
    name: 'Air Attunement',
    type: 'Profession',
    slot: 'Profession_3',
    mechanicSlot: 3,
    categories: ['Attunement'],
    castTimeMs: 0,
    cooldown: 0,
    canCastConcurrently: true,
    skillFamily: 'Attunement',
    effects: []
  },
  [ID.EARTH_ATTUNEMENT]: {
    inputCategory: 'bar-swap', // Explicit weapon or profession bar replacement.
    name: 'Earth Attunement',
    type: 'Profession',
    slot: 'Profession_4',
    mechanicSlot: 4,
    categories: ['Attunement'],
    castTimeMs: 0,
    cooldown: 0,
    canCastConcurrently: true,
    skillFamily: 'Attunement',
    effects: []
  }
});
