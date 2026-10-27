import { defineFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Declares revenant specializations renegade profile tuning once for validation, patch controls, and labels. */
export const REVENANT_RENEGADE_PROFILE_FIELDS = defineFields({
  // Strike, condition, and general damage scaling.
  lifeSiphonDamagePerStack: numberField({ patch: 'primary', unit: 'fraction' }),

  // Attributes, summon inheritance, and critical-hit scaling.
  fullEnduranceCriticalChance: numberField({ patch: 'primary', unit: 'probability', maximum: 1 }),

  // Stacks, targets, and proc gates.
  fervorStacks: numberField({ patch: 'primary' })
});
