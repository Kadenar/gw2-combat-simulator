/** Explicit Core follow-ups; their owning mechanics control activation and expiry. */
import type { SkillFlips } from '#gw2/platform/skills/skill-flip-definitions.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';

export const NECROMANCER_CORE_SKILL_FLIPS: SkillFlips = Object.freeze([
  { parentId: ID.SUMMON_BONE_MINIONS, followUpId: ID.PUTRID_EXPLOSION },
  { parentId: ID.SUMMON_BONE_FIEND, followUpId: ID.RIGOR_MORTIS },
  { parentId: ID.SUMMON_BLOOD_FIEND, followUpId: ID.TASTE_OF_DEATH },
  { parentId: ID.DEATH_SHROUD, followUpId: ID.END_DEATH_SHROUD },
  { parentId: ID.SUMMON_SHADOW_FIEND, followUpId: ID.HAUNT },
  { parentId: ID.SUMMON_FLESH_GOLEM, followUpId: ID.CHARGE },
  { parentId: ID.RIPPLE_OF_HORROR, followUpId: ID.MARCH_OF_UNDEATH },
  { parentId: ID.DARK_PATH, followUpId: ID.DARK_PURSUIT },
  { parentId: ID.PATH_OF_GLUTTONY, followUpId: ID.GORGE },
  { parentId: ID.RAVENOUS_WAVE, followUpId: ID.SATIATE },
  { parentId: ID.DEVOURING_VISAGE, followUpId: ID.CONSUME },
  { parentId: ID.HUNGERING_MAELSTROM, followUpId: ID.GORMANDIZE },
  { parentId: ID.ISOLATE, followUpId: ID.DISTRESS },
  { parentId: ID.LICH_FORM, followUpId: ID.EXIT_LICH_FORM }
]);
