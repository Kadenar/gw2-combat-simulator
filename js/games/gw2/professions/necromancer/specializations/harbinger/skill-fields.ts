import { defineSkillFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Harbinger fields read only by Harbinger mechanics. */
export const HARBINGER_SKILL_FIELDS = defineSkillFields(
  {
    // Skills settle their own Blight cost and gain at the existing launch and impact boundaries.
    blightCost: numberField({ patch: 'primary' }),
    blightGain: numberField({ patch: 'primary' }),
    doomApproachesPulseCount: numberField({ patch: 'primary' }),
    doomApproachesPulseInterval: numberField({ unit: 'seconds', patch: 'advanced' })
  },
  'Harbinger'
);
