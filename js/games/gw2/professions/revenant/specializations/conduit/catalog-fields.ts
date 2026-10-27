import { attributeFields } from '#gw2/platform/skills/attribute-fields.js';
import { dataField, defineFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Conduit fields read only by Conduit mechanics. */
export const CONDUIT_SKILL_FIELDS = defineFields(
  {
    // Release Potential: Dervish unlocks unequipped-legend rewards at this Affinity count.
    allLegendAffinityThreshold: numberField({ patch: 'advanced' }),
    // Grants legend affinity when the skill hits.
    affinityOnHit: dataField
  },
  'Conduit'
);

/** Declares revenant specializations conduit profile tuning once for validation, patch controls, and labels. */
export const REVENANT_CONDUIT_PROFILE_FIELDS = defineFields({
  // Attributes, summon inheritance, and critical-hit scaling.
  ...attributeFields('assassinAttributeBonuses', 'Assassin '),
  ...attributeFields('centaurAttributeBonuses', 'Centaur '),
  ...attributeFields('demonAttributeBonuses', 'Demon '),
  ...attributeFields('dwarfAttributeBonuses', 'Dwarf '),
  ...attributeFields('entityAttributeBonuses', 'Entity ')
});
