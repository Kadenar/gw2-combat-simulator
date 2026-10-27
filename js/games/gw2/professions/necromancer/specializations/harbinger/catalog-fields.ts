import { defineFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Harbinger fields read only by Harbinger mechanics. */
export const HARBINGER_SKILL_FIELDS = defineFields(
  {
    // Skills settle their own Blight cost and gain at the existing launch and impact boundaries.
    blightCost: numberField({ patch: 'primary' }),
    blightGain: numberField({ patch: 'primary' }),
    doomApproachesPulseCount: numberField({ patch: 'primary' }),
    doomApproachesPulseInterval: numberField({ unit: 'seconds', patch: 'advanced' })
  },
  'Harbinger'
);

/** Declares necromancer specializations harbinger profile tuning once for validation, patch controls, and labels. */
export const NECROMANCER_HARBINGER_PROFILE_FIELDS = defineFields({
  // Recharge, resource costs, and regeneration.
  blightGain: numberField({ patch: 'primary' })
});
