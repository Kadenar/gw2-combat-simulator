import { defineFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Declares engineer specializations scrapper profile tuning once for validation, patch controls, and labels. */
export const ENGINEER_SCRAPPER_PROFILE_FIELDS = defineFields({
  // Recharge, resource costs, and regeneration.
  maximumAmmo: numberField({ patch: 'primary' })
});
