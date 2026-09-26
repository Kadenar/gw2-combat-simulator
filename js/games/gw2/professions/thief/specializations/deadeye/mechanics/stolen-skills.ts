import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';

/** Stolen skills a Deadeye steal can grant, shared by the hooks and the skill palette. */
export const DEADEYE_STOLEN_SKILL_IDS: readonly SkillId[] = Object.freeze([
  ID.STEAL_TIME,
  ID.STEAL_WARMTH,
  ID.STEAL_RESISTANCE,
  ID.STEAL_PRECISION,
  ID.STEAL_HEALTH,
  ID.STEAL_STRENGTH,
  ID.STEAL_DURABILITY,
  ID.STEAL_DEFENSES,
  ID.STEAL_MOBILITY
]);
