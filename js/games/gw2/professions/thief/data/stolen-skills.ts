/** Shared stolen-skill identities keep inventory admission and traits on the same supported pools. */
import type { SkillId } from '#gw2/platform/skills/types.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';

// Each base Steal offers the same three supported stolen skills for the user to choose from.
export const THIEF_STOLEN_SKILL_IDS: readonly SkillId[] = Object.freeze([
  ID.DETONATE_PLASMA,
  ID.THROW_MAGNETIC_BOMB,
  ID.SOUL_STONE_VENOM
]);

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

/** Membership is shared by accepted-cast snapshots and stolen-skill traits. */
export const DEADEYE_STOLEN_SKILL_ID_SET = new Set<SkillId>(DEADEYE_STOLEN_SKILL_IDS);

/** Recognizes supported stolen skills even when their stored use has already been consumed. */
export function isThiefStolenSkill(skillId: SkillId | undefined): boolean {
  return skillId != null && (THIEF_STOLEN_SKILL_IDS.includes(skillId) || DEADEYE_STOLEN_SKILL_ID_SET.has(skillId));
}
