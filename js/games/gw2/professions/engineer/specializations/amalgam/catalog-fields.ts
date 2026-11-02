import { defineFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Amalgam owns Evolve's attribute scaling, protocol retaliation cadence, and persistent strain tuning. */
export const AMALGAM_SKILL_FIELDS = defineFields(
  {
    /** Evolve scales its eligible attribute pool before profession-specific conversions. */
    attributeMultiplier: numberField({ patch: 'primary' }),
    retaliationInterval: numberField({ patch: 'primary', unit: 'seconds' }),
    rapaciousDuration: numberField({ patch: 'primary', unit: 'seconds' }),
    rapaciousInternalCooldown: numberField({ patch: 'primary', unit: 'seconds' }),
    titanicAttributePerStack: numberField({ patch: 'primary' })
  },
  'Amalgam'
);
