import { defineSkillFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Intrinsic tuning belongs to the selected weapon or virtue; shared controllers consume these fields. */
export const GUARDIAN_CORE_SKILL_FIELDS = defineSkillFields(
  {
    illuminatedDamageMultiplier: numberField({ patch: 'primary' }),
    passiveInterval: numberField({ patch: 'primary', unit: 'seconds' }),
    tetherInterval: numberField({ patch: 'primary', unit: 'seconds' })
  },
  'Guardian Core'
);
