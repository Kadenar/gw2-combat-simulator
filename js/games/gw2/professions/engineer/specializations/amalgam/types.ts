import type { EngineerSkill } from '#gw2/professions/engineer/types.js';
import type { NumericSkillFields } from '#gw2/platform/skills/field-specs.js';
import type { AMALGAM_SKILL_FIELDS } from '#gw2/professions/engineer/specializations/amalgam/skill-fields.js';

/** Amalgam skills expose tuning declared by their module. */
export interface AmalgamSkill extends EngineerSkill, NumericSkillFields<typeof AMALGAM_SKILL_FIELDS> {}
