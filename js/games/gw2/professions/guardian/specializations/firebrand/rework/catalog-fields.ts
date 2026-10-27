import { defineFields, numberField } from '#gw2/platform/skills/field-specs.js';
import { GUARDIAN_FIREBRAND_PROFILE_FIELDS } from '#gw2/professions/guardian/specializations/firebrand/catalog-fields.js';

/** The rework adds a party-target limit while retaining the module's profile identity selectors. */
export const FIREBRAND_REWORK_PROFILE_FIELDS = defineFields({
  ...GUARDIAN_FIREBRAND_PROFILE_FIELDS,
  // Stacks, targets, and proc gates.
  maximumTargets: numberField({ patch: 'advanced' })
});
