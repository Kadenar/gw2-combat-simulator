import { defineFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Declares ranger specializations untamed profile tuning once for validation, patch controls, and labels. */
export const RANGER_UNTAMED_PROFILE_FIELDS = defineFields({
  // Tiered damage curves and activation thresholds.
  stackThreshold: numberField({ patch: 'primary' })
});
