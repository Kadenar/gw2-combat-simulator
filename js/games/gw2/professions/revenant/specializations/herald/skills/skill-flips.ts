/** Explicit Herald follow-ups; their owning mechanics control activation and expiry. */
import type { SkillFlips } from '#gw2/platform/skills/skill-flip-definitions.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';

export const REVENANT_HERALD_SKILL_FLIPS: SkillFlips = Object.freeze([
  { parentId: ID.FACET_OF_DARKNESS, followUpId: ID.GAZE_OF_DARKNESS },
  { parentId: ID.FACET_OF_LIGHT, followUpId: ID.INFUSE_LIGHT },
  { parentId: ID.FACET_OF_CHAOS, followUpId: ID.CHAOTIC_RELEASE },
  { parentId: ID.FACET_OF_STRENGTH, followUpId: ID.BURST_OF_STRENGTH },
  { parentId: ID.FACET_OF_ELEMENTS, followUpId: ID.ELEMENTAL_BLAST }
]);
