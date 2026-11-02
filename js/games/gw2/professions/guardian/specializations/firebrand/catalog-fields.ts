import { dataField, defineFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Firebrand tome fields read only by Firebrand mechanics. */
export const FIREBRAND_SKILL_FIELDS = defineFields(
  {
    dormantCooldown: numberField({ patch: 'primary', unit: 'seconds' })
  },
  'Firebrand'
);

/** Declares guardian specializations firebrand profile tuning once for validation, patch controls, and labels. */
export const GUARDIAN_FIREBRAND_PROFILE_FIELDS = defineFields({
  // Identity, presentation, and executable declarations.
  capacityTrait: dataField,
  intervalTrait: dataField
});
