import { defineFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Declares elementalist specializations catalyst profile tuning once for validation, patch controls, and labels. */
export const ELEMENTALIST_CATALYST_PROFILE_FIELDS = defineFields({
  // Recharge, resource costs, and regeneration.
  resourceCost: numberField({ patch: 'primary' })
});
