/** Explicit Daredevil follow-ups; their owning mechanics control activation and expiry. */
import type { SkillFlips } from '#gw2/platform/skills/skill-flip-definitions.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';

export const THIEF_DAREDEVIL_SKILL_FLIPS: SkillFlips = Object.freeze([
  { parentId: ID.BANDITS_DEFENSE, followUpId: ID.REFLEXIVE_STRIKE },
  { parentId: ID.FIST_FLURRY, followUpId: ID.PALM_STRIKE },
  { parentId: ID.IMPACT_STRIKE, followUpId: ID.UPPERCUT },
  { parentId: ID.UPPERCUT, followUpId: ID.FINISHING_BLOW }
]);
