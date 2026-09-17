import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';

// Static spear chain stages shared by catalog metadata and Core spear-chain behavior.
const SPEAR_LEAD_SKILLS = new Set<number>([ID.MANTIS_STING, ID.UNSUSPECTING_STRIKE]);
const SPEAR_FOLLOW_UP_SKILLS = new Set<number>([ID.ENTANGLING_ASP, ID.VAMPIRIC_SLASH]);
const SPEAR_FINISHER_SKILLS = new Set<number>([ID.FALLING_SPIDER, ID.SHATTERING_ASSAULT]);
const SPEAR_CHAIN_STAGE_BY_SKILL = new Map<number, number>([
  ...[...SPEAR_LEAD_SKILLS].map((skillId) => [skillId, 0] as const),
  ...[...SPEAR_FOLLOW_UP_SKILLS].map((skillId) => [skillId, 1] as const),
  ...[...SPEAR_FINISHER_SKILLS].map((skillId) => [skillId, 2] as const)
]);

export function spearChainStageForSkill(skillId: SkillId): number | null {
  return SPEAR_CHAIN_STAGE_BY_SKILL.get(Number(skillId)) ?? null;
}
