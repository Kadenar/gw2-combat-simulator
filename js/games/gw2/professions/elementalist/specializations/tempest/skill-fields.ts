import { dataField, defineSkillFields } from '#gw2/platform/skills/field-specs.js';

/** Tempest skill fields read only by Tempest mechanics. */
export const TEMPEST_SKILL_FIELDS = defineSkillFields(
  {
    // Marks the four overload skills that share overload readiness and dwell.
    overload: dataField
  },
  'Tempest'
);
