import { dataField, defineSkillFields } from '#gw2/platform/skills/field-specs.js';

/** Conduit fields read only by Conduit mechanics. */
export const CONDUIT_SKILL_FIELDS = defineSkillFields(
  {
    // Grants legend affinity when the skill hits.
    affinityOnHit: dataField
  },
  'Conduit'
);
