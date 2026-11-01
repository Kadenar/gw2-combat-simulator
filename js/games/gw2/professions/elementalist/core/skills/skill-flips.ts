/** Explicit Core follow-ups; their owning mechanics control activation and expiry. */
import type { SkillFlips } from '#gw2/platform/skills/skill-flip-definitions.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';

export const ELEMENTALIST_CORE_SKILL_FLIPS: SkillFlips = Object.freeze([
  { parentId: ID.GLYPH_OF_ELEMENTALS, followUpId: ID.FLAME_BARRAGE_ELEMENTAL_COMMAND },
  { parentId: ID.GLYPH_OF_ELEMENTALS_EARTH, followUpId: ID.STOMP_ELEMENTAL_COMMAND },
  { parentId: ID.MAGNETIC_AURA, followUpId: ID.TRANSMUTE_EARTH },
  { parentId: ID.ROCK_BARRIER, followUpId: ID.HURL },
  { parentId: ID.FROST_AURA, followUpId: ID.TRANSMUTE_FROST },
  { parentId: ID.SHOCKING_AURA, followUpId: ID.TRANSMUTE_LIGHTNING },
  { parentId: ID.FIRE_SHIELD, followUpId: ID.TRANSMUTE_FIRE }
]);
