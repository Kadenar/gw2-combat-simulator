import { dataField, defineSkillFields } from '#gw2/platform/skills/field-specs.js';

/** Druid fields read only by Druid mechanics. */
export const DRUID_SKILL_FIELDS = defineSkillFields(
  {
    // Available only while Celestial Avatar is active.
    celestialAvatarSkill: dataField
  },
  'Druid'
);
