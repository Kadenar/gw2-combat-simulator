import type { EngineerSkill } from '#gw2/professions/engineer/types.js';
import type { NumericSkillFields } from '#gw2/platform/skills/field-specs.js';
import type { MECHANIST_SKILL_FIELDS } from '#gw2/professions/engineer/specializations/mechanist/catalog-fields.js';

/** Mechanist skills expose their locally registered numeric tuning. */
export interface MechanistSkill extends EngineerSkill, NumericSkillFields<typeof MECHANIST_SKILL_FIELDS> {}
