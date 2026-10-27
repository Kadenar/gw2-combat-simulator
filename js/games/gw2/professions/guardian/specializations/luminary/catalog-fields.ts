import { dataField, defineFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Luminary Radiant Forge fields read only by Luminary mechanics. */
export const LUMINARY_SKILL_FIELDS = defineFields(
  {
    // Marks skills available only while Radiant Forge is active.
    radiantForgeSkill: dataField,
    // The Radiant Forge weapon this skill belongs to.
    radiantWeapon: dataField,
    // Delayed detonations scale their owned payload by this fraction per capped hit.
    damageIncreasePerStack: numberField({ patch: 'primary' })
  },
  'Luminary'
);
