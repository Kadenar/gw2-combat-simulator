/** Explicit Luminary follow-ups; their owning mechanics control activation and expiry. */
import type { SkillFlips } from '#gw2/platform/skills/skill-flip-definitions.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';

export const GUARDIAN_LUMINARY_SKILL_FLIPS: SkillFlips = Object.freeze([
  { parentId: ID.ENTER_RADIANT_FORGE, followUpId: ID.EXIT_RADIANT_FORGE },
  { parentId: ID.DAZZLING_HAMMER, followUpId: ID.SHINING_SPIN },
  { parentId: ID.LUMINOUS_STAFF, followUpId: ID.RESTORATIVE_GLOW },
  { parentId: ID.GLEAMING_BLADE, followUpId: ID.LUCENT_THRUST },
  { parentId: ID.RADIANT_BULWARK, followUpId: ID.BRILLIANT_SLAM }
]);
