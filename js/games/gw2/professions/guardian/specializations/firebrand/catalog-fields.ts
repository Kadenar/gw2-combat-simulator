import { defineFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Firebrand tome fields read only by Firebrand mechanics. */
export const FIREBRAND_SKILL_FIELDS = defineFields(
  {
    dormantCooldown: numberField({ patch: 'primary', unit: 'seconds' })
  },
  'Firebrand'
);

/** Declares guardian specializations firebrand profile tuning once for validation, patch controls, and labels. */
export const GUARDIAN_FIREBRAND_PROFILE_FIELDS = defineFields({
  // Swift Scholar rewards use an explicit party-recipient limit.
  maximumTargets: numberField({ patch: 'advanced' }),
  allyStacks: numberField({ patch: 'advanced', label: 'Ashes charges per ally' })
});
