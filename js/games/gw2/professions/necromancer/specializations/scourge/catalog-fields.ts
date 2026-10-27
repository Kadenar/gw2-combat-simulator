import { defineFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Scourge fields read only by Scourge mechanics. */
export const SCOURGE_SKILL_FIELDS = defineFields(
  {
    // Manifest owns shade capacity and its Dhuumfire interaction; Desert Shroud owns its delayed impact.
    dhuumfireInterval: numberField({ unit: 'seconds', patch: 'advanced' }),
    impactDelayMs: numberField({ unit: 'milliseconds', patch: 'advanced' }),
    // Fixed life-force points paid by the shared skill-cost lifecycle through the skill's cost amount.
    lifeForceCost: numberField({ patch: 'primary' })
  },
  'Scourge'
);

/** Declares necromancer specializations scourge profile tuning once for validation, patch controls, and labels. */
export const NECROMANCER_SCOURGE_PROFILE_FIELDS = defineFields({
  // Recharge, resource costs, and regeneration.
  rechargePenalty: numberField({ patch: 'primary', unit: 'factor' })
});
