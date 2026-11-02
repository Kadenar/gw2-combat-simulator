import { defineFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Declares ranger specializations druid profile tuning once for validation, patch controls, and labels. */
export const RANGER_DRUID_PROFILE_FIELDS = defineFields({
  // Recharge, resource costs, and regeneration.
  astralForceRetentionMultiplier: numberField({ patch: 'primary', unit: 'factor', maximum: 1 })
});
