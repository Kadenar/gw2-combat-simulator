import { defineSkillFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Thorns owns the cadence of its conditional retaliation component. */
export const AMALGAM_SKILL_FIELDS = defineSkillFields(
  { retaliationInterval: numberField({ patch: 'primary', unit: 'seconds' }) },
  'Amalgam'
);
