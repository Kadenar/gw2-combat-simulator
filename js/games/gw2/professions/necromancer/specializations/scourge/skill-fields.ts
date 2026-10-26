import { defineSkillFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Scourge fields read only by Scourge mechanics. */
export const SCOURGE_SKILL_FIELDS = defineSkillFields(
  {
    // Fixed life-force points paid by the shared skill-cost lifecycle through the skill's cost amount.
    lifeForceCost: numberField()
  },
  'Scourge'
);
