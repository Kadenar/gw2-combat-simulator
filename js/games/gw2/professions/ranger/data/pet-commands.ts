import type { SkillId } from '#gw2/platform/skills/types.js';
import type { RangerSkill } from '#gw2/professions/ranger/types.js';

/** Untamed reserves natural F1/F2/F3 skills for explicit commands in either unleash state. */
export function rangerPetSkillsRequireCommands(specialization: string): boolean {
  return specialization === 'Untamed';
}

/** Untamed can command natural pet skills with recharge, while basic attacks remain automatic. */
export function rangerPetSkillCommandable(skill: RangerSkill | undefined, specialization: string): boolean {
  return Boolean(
    skill?.petSkill &&
    (!skill.petAutonomousSkill || (rangerPetSkillsRequireCommands(specialization) && (skill.cooldown || 0) > 0))
  );
}

/**
 * The active pet's commandable skills in bar order: natural F1/F3 family skills with the beast command placed
 * between them in F2. Combat input resolution and the palette share this order.
 */
export function rangerPetCommandBar(
  petSkillIds: readonly SkillId[],
  skillsById: ReadonlyMap<SkillId, RangerSkill>,
  specialization: string
): SkillId[] {
  const skillIds = petSkillIds.filter((id) => rangerPetSkillCommandable(skillsById.get(id), specialization));
  const beastIndex = skillIds.findIndex((id) => !skillsById.get(id)?.petAutonomousSkill);
  if (beastIndex > 1) skillIds.splice(1, 0, ...skillIds.splice(beastIndex, 1));
  return skillIds;
}
