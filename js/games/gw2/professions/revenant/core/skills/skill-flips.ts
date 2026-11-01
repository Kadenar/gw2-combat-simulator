/** Explicit Core follow-ups; their owning mechanics control activation and expiry. */
import type { SkillFlips } from '#gw2/platform/skills/skill-flip-definitions.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';

export const REVENANT_CORE_SKILL_FLIPS: SkillFlips = Object.freeze([
  { parentId: ID.EMBRACE_THE_DARKNESS, followUpId: ID.RESIST_THE_DARKNESS },
  { parentId: ID.VENGEFUL_HAMMERS, followUpId: ID.RELEASE_HAMMERS },
  { parentId: ID.PROTECTIVE_SOLACE, followUpId: ID.DIMINISH_SOLACE },
  { parentId: ID.IMPOSSIBLE_ODDS, followUpId: ID.RELINQUISH_POWER },
  { parentId: ID.PROJECT_TRANQUILITY, followUpId: ID.VENTARIS_WILL },
  { parentId: ID.IMPERIAL_GUARD, followUpId: ID.TRUE_STRIKE },
  { parentId: ID.OTHERWORLDLY_BOND, followUpId: ID.DEACTIVATE_OTHERWORLDLY_BOND },
  { parentId: ID.BLOSSOMING_AURA, followUpId: ID.DETONATE_BLOSSOMING_AURA },
  { parentId: ID.CALL_TO_ANGUISH, followUpId: ID.UNYIELDING_IMPACT },
  { parentId: ID.DEACTIVATE_OTHERWORLDLY_BOND, followUpId: ID.OTHERWORLDLY_ATTRACTION_ENEMY }
]);
