import { dataField, defineSkillFields } from '#gw2/platform/skills/field-specs.js';

/** Firebrand tome fields read only by Firebrand mechanics. */
export const FIREBRAND_SKILL_FIELDS = defineSkillFields(
  {
    // The tome whose pages this skill spends.
    tome: dataField
  },
  'Firebrand'
);
