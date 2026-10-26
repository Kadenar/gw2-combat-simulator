import { dataField, defineSkillFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Conduit fields read only by Conduit mechanics. */
export const CONDUIT_SKILL_FIELDS = defineSkillFields(
  {
    // Release Potential: Dervish unlocks unequipped-legend rewards at this Affinity count.
    allLegendAffinityThreshold: numberField({ patch: 'advanced' }),
    // Grants legend affinity when the skill hits.
    affinityOnHit: dataField
  },
  'Conduit'
);
