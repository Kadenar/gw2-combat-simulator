import { defineFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Commands own their delayed resource reward; the common echo scheduler only determines delivery. */
export const PARAGON_SKILL_FIELDS = defineFields({ echoResourceGain: numberField({ patch: 'primary' }) }, 'Paragon');

/** Declares warrior specializations paragon profile tuning once for validation, patch controls, and labels. */
export const WARRIOR_PARAGON_PROFILE_FIELDS = defineFields({
  // Strike, condition, and general damage scaling.
  strikeBonus: numberField({ patch: 'primary' }),
  conditionBonus: numberField({ patch: 'primary' }),

  // Tiered damage curves and activation thresholds.
  highThreshold: numberField({ patch: 'primary' }),
  strikeLow: numberField({ patch: 'primary' }),
  strikeMiddle: numberField({ patch: 'primary' }),
  strikeHigh: numberField({ patch: 'primary' }),
  conditionLow: numberField({ patch: 'primary' }),
  conditionMiddle: numberField({ patch: 'primary' }),
  conditionHigh: numberField({ patch: 'primary' })
});
