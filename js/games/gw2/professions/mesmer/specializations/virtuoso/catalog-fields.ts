import { defineFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Declares mesmer specializations virtuoso profile tuning once for validation, patch controls, and labels. */
export const MESMER_VIRTUOSO_PROFILE_FIELDS = defineFields({
  // Strike, condition, and general damage scaling.
  weaponStrength: numberField({ patch: 'advanced' }),

  // Attributes, summon inheritance, and critical-hit scaling.
  vitalityConversion: numberField({ patch: 'primary', unit: 'fraction' }),
  phantasmCriticalChance: numberField({ patch: 'primary', unit: 'probability', maximum: 1 })
});
