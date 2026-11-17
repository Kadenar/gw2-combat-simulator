import { defineFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Intrinsic tuning belongs to the selected weapon or virtue; shared controllers consume these fields. */
export const GUARDIAN_CORE_SKILL_FIELDS = defineFields(
  {
    // Number of qualifying hits required by the untraited Justice passive.
    threshold: numberField({ patch: 'primary' }),
    illuminatedDamageMultiplier: numberField({ patch: 'primary' }),
    passiveInterval: numberField({ patch: 'primary', unit: 'seconds' }),
    tetherInterval: numberField({ patch: 'primary', unit: 'seconds' })
  },
  'Guardian Core'
);

/** Declares guardian core profile tuning once for validation, patch controls, and labels. */
export const GUARDIAN_CORE_PROFILE_FIELDS = defineFields({
  // Stacks, targets, and proc gates.
  maximumDamageStacks: numberField({ patch: 'primary' })
});
