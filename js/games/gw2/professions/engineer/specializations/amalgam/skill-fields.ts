import { defineSkillFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Protocols own their retaliation cadence and persistent strain tuning. */
export const AMALGAM_SKILL_FIELDS = defineSkillFields(
  {
    retaliationInterval: numberField({ patch: 'primary', unit: 'seconds' }),
    rapaciousDuration: numberField({ patch: 'primary', unit: 'seconds' }),
    rapaciousInternalCooldown: numberField({ patch: 'primary', unit: 'seconds' }),
    titanicAttributePerStack: numberField({ patch: 'primary' })
  },
  'Amalgam'
);
