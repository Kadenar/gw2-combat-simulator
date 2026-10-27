import { dataField, defineFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Druid fields read only by Druid mechanics. */
export const DRUID_SKILL_FIELDS = defineFields(
  {
    // Available only while Celestial Avatar is active.
    celestialAvatarSkill: dataField
  },
  'Druid'
);

/** Declares ranger specializations druid profile tuning once for validation, patch controls, and labels. */
export const RANGER_DRUID_PROFILE_FIELDS = defineFields({
  // Recharge, resource costs, and regeneration.
  astralForceRetentionMultiplier: numberField({ patch: 'primary', unit: 'factor', maximum: 1 })
});
