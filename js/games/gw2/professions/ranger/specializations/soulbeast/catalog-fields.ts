import { defineFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Declares ranger specializations soulbeast profile tuning once for validation, patch controls, and labels. */
export const RANGER_SOULBEAST_PROFILE_FIELDS = defineFields({
  // Durations, extensions, and recurring effects.
  sharedDurationMultiplier: numberField({ patch: 'primary', unit: 'factor' })
});
