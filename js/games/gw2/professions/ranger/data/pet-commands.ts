import type { SkillId } from '#gw2/platform/skills/types.js';
import { RANGER_PETS } from '#gw2/professions/ranger/data/ranger-pet-data.js';
import type { RangerPetDefinition, RangerSkill } from '#gw2/professions/ranger/types.js';

/** Untamed reserves natural F1/F2/F3 skills for explicit commands in either unleash state. */
export function rangerPetSkillsRequireCommands(specialization: string): boolean {
  return specialization === 'Untamed';
}

/** The beast command is available to every specialization. Untamed can also command its pet's recharging specials. */
export function rangerPetSkillCommandable(
  pet: RangerPetDefinition,
  skill: RangerSkill | undefined,
  specialization: string
): boolean {
  return Boolean(
    skill?.petSkill &&
    (pet.beastSkillId === skill.id ||
      (rangerPetSkillsRequireCommands(specialization) &&
        pet.specialSkillIds.includes(skill.id) &&
        (skill.cooldown ?? 0) > 0))
  );
}

/** Log sources can omit the pet's identity. Match its command against the roster before replay. */
export function rangerRecordedPetCommand(skill: RangerSkill | undefined, specialization: string): boolean {
  return Boolean(skill?.petSkill && RANGER_PETS.some((pet) => rangerPetSkillCommandable(pet, skill, specialization)));
}

/** A rotation can contain commands from either side of a pet swap. */
export function rangerRotationSkillAllowed(skill: RangerSkill | null | undefined, specialization: string): boolean {
  return !skill?.petSkill || rangerRecordedPetCommand(skill, specialization);
}

/** An empty F1 or F3 leaves the beast command on F2. Only the palette compacts empty slots. */
export function rangerPetCommandSlots(pet: RangerPetDefinition) {
  return [pet.specialSkillIds[0], pet.beastSkillId, pet.specialSkillIds[1]] as const;
}

export function rangerPetCommandBar(
  pet: RangerPetDefinition,
  skillsById: ReadonlyMap<SkillId, RangerSkill>,
  specialization: string
): SkillId[] {
  return rangerPetCommandSlots(pet).filter(
    (id): id is SkillId => id != null && rangerPetSkillCommandable(pet, skillsById.get(id), specialization)
  );
}
