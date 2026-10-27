import { defineFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Declares necromancer specializations reaper profile tuning once for validation, patch controls, and labels. */
export const NECROMANCER_REAPER_PROFILE_FIELDS = defineFields({
  // Attributes, summon inheritance, and critical-hit scaling.
  criticalChancePerStack: numberField({ patch: 'primary', unit: 'fraction' })
});
