import { defineSkillFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Commands own their delayed resource reward; the common echo scheduler only determines delivery. */
export const PARAGON_SKILL_FIELDS = defineSkillFields(
  { echoResourceGain: numberField({ patch: 'primary' }) },
  'Paragon'
);
