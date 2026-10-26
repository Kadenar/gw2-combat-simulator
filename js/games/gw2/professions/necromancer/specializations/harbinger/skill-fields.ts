import { defineSkillFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Harbinger fields read only by Harbinger mechanics. */
export const HARBINGER_SKILL_FIELDS = defineSkillFields(
  {
    // Burning duration applied by Dhuumfire through this skill.
    dhuumfireDuration: numberField({ patch: 'primary' })
  },
  'Harbinger'
);
