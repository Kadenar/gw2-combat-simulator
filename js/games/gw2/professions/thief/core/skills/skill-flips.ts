/** Explicit Core follow-ups; their owning mechanics control activation and expiry. */
import type { SkillFlips } from '#gw2/platform/skills/skill-flip-definitions.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';

export const THIEF_CORE_SKILL_FLIPS: SkillFlips = Object.freeze([
  { parentId: ID.FLANKING_STRIKE, followUpId: ID.LARCENOUS_STRIKE },
  { parentId: ID.CLUSTER_BOMB, followUpId: ID.DETONATE_CLUSTER },
  { parentId: ID.SNIPERS_COVER, followUpId: ID.DEATHS_ADVANCE },
  { parentId: ID.PREPARE_PITFALL, followUpId: ID.PITFALL },
  { parentId: ID.PREPARE_THOUSAND_NEEDLES, followUpId: ID.THOUSAND_NEEDLES },
  { parentId: ID.SHADOW_STRIKE, followUpId: ID.REPEATER_ID_59526 },
  { parentId: ID.MEASURED_SHOT, followUpId: ID.ENDLESS_NIGHT },
  { parentId: ID.DEBILITATING_ARC, followUpId: ID.HELMET_BREAKER },
  { parentId: ID.INFILTRATORS_STRIKE, followUpId: ID.INFILTRATORS_RETURN }
]);
