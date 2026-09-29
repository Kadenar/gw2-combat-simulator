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
