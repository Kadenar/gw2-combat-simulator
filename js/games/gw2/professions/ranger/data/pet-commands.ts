import type { RangerSkill } from '#gw2/professions/ranger/types.js';

/** Untamed can command natural pet skills with recharge, while basic attacks remain automatic. */
export function rangerPetSkillCommandable(skill: RangerSkill | undefined, specialization: string): boolean {
  return Boolean(
    skill?.petSkill && (!skill.petAutonomousSkill || (specialization === 'Untamed' && (skill.cooldown || 0) > 0))
  );
}
