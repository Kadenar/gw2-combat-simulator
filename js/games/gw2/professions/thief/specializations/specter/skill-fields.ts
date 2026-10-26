import { dataField, defineSkillFields } from '#gw2/platform/skills/field-specs.js';

/** Specter fields read only by Specter mechanics. */
export const SPECTER_SKILL_FIELDS = defineSkillFields(
  {
    // How Specter Steal variants share their recharge.
    stealRechargeMode: dataField
  },
  'Specter'
);
