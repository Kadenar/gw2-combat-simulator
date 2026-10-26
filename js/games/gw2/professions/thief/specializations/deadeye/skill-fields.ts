import { dataField, defineSkillFields } from '#gw2/platform/skills/field-specs.js';

/** Deadeye fields read only by Deadeye mechanics. */
export const DEADEYE_SKILL_FIELDS = defineSkillFields(
  {
    // Spends malice for its enhanced variant.
    malicious: dataField
  },
  'Deadeye'
);
