import { defineSkillFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Signet passive tuning is read only by Mechanist's modifier and recharge owners. */
export const MECHANIST_SKILL_FIELDS = defineSkillFields(
  {
    damageIncrease: numberField({ patch: 'primary' }),
    conditionDamageIncrease: numberField({ patch: 'primary' }),
    rechargeMultiplier: numberField({ patch: 'primary' })
  },
  'Mechanist'
);
