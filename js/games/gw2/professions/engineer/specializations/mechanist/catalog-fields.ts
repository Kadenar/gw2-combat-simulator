import { defineFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Signet passive tuning is read only by Mechanist's modifier and recharge owners. */
export const MECHANIST_SKILL_FIELDS = defineFields(
  {
    damageIncrease: numberField({ patch: 'primary' }),
    conditionDamageIncrease: numberField({ patch: 'primary' }),
    rechargeMultiplier: numberField({ patch: 'primary' })
  },
  'Mechanist'
);

/** Declares engineer specializations mechanist profile tuning once for validation, patch controls, and labels. */
export const ENGINEER_MECHANIST_PROFILE_FIELDS = defineFields({
  // Durations, extensions, and recurring effects.
  interval: numberField({ patch: 'primary', unit: 'seconds' })
});
