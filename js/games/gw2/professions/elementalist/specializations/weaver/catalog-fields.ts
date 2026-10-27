import { defineFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Weaver skill fields read only by Weaver mechanics. */
export const WEAVER_SKILL_FIELDS = defineFields(
  {
    // Purblinding Plasma's factor, applied only while reserving recharge with an Air bullet loaded.
    airBulletRechargeMultiplier: numberField({ patch: 'primary' })
  },
  'Weaver'
);
