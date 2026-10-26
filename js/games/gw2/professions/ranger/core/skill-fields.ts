import { dataField, defineSkillFields } from '#gw2/platform/skills/field-specs.js';

/** Ranger pet fields read only by Ranger mechanics. */
export const RANGER_CORE_SKILL_FIELDS = defineSkillFields(
  {
    // Executed by the pet rather than the player.
    petSkill: dataField,
    // Belongs to the selected pet family's skill set.
    petFamilySkill: dataField,
    // Pets that own this skill.
    petNames: dataField,
    // Available only while merged with the pet.
    beastmodeSkill: dataField,
    // Pet skill used while the pet is unleashed.
    unleashedPetSkill: dataField
  },
  'Ranger Core'
);
