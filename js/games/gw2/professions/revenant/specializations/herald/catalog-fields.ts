import { dataField, defineFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Herald facet fields read only by Herald mechanics. */
export const HERALD_SKILL_FIELDS = defineFields(
  {
    // Boon pulse granted while the facet upkeep is active.
    upkeepPulse: dataField,
    // Duration of each upkeep boon pulse.
    'upkeepPulse.duration': numberField({ patch: 'primary' }),
    // Stacks granted by each upkeep boon pulse.
    'upkeepPulse.stacks': numberField({ patch: 'primary' })
  },
  'Herald'
);

/** Declares revenant specializations herald profile tuning once for validation, patch controls, and labels. */
export const REVENANT_HERALD_PROFILE_FIELDS = defineFields({
  // Strike, condition, and general damage scaling.
  upkeepDamageIncrease: numberField({ patch: 'primary', unit: 'fraction' }),

  // Attributes, summon inheritance, and critical-hit scaling.
  criticalChanceBonus: numberField({ patch: 'primary', unit: 'probability', maximum: 1 }),

  // Durations, extensions, and recurring effects.
  boonDurationBonus: numberField({ patch: 'primary', unit: 'percent' })
});
