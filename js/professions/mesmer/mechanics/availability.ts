/**
 * Stable application-facing availability facade.
 * Runtime ownership lives in Core and the active specialization.
 */
import { mesmerAvailability } from '../core/availability.js';
import { MECHANIC_SKILLS, SHATTERS } from './skill-mechanics.js';
import type { MesmerConfig, MesmerSkill } from '../types.js';

export { mesmerAvailability };

export function isMesmerContinuumSkillAvailable(skill: MesmerSkill, continuumActive: boolean): boolean {
  return skill.id !== -4 || Boolean(continuumActive);
}

export function isMesmerBuildSkillAvailable(
  skill: MesmerSkill,
  config: Pick<MesmerConfig, 'specialization' | 'weaponmasterTraining'>
): boolean {
  if (skill.ambush) return config.specialization === 'Mirage';
  if (skill.id < 0) {
    return !skill.specialization || skill.specialization === config.specialization;
  }

  if (skill.environment !== 'Terrestrial') return false;
  if (skill.type === 'Profession') {
    return (MECHANIC_SKILLS[config.specialization] || []).includes(skill.id);
  }

  if (skill.specialization && skill.type !== 'Weapon' && skill.specialization !== config.specialization) {
    return false;
  }

  if (
    skill.specialization &&
    skill.type === 'Weapon' &&
    !config.weaponmasterTraining &&
    skill.specialization !== config.specialization
  ) {
    return false;
  }

  return true;
}

export function mesmerMinimumResource(skill: MesmerSkill): number {
  return Number(SHATTERS[skill.id]?.minimumResource || 0);
}
