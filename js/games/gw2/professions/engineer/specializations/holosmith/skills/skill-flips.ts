/** Explicit Holosmith follow-ups; their owning mechanics control activation and expiry. */
import type { SkillFlips } from '#gw2/platform/skills/skill-flip-definitions.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';

export const ENGINEER_HOLOSMITH_SKILL_FLIPS: SkillFlips = Object.freeze([
  { parentId: ID.PHOTON_WALL, followUpId: ID.LAUNCH_WALL },
  { parentId: ID.ENGAGE_PHOTON_FORGE, followUpId: ID.DEACTIVATE_PHOTON_FORGE }
]);
