import type { NumericSkillFields } from '#gw2/platform/skills/field-specs.js';
import type { AMALGAM_SKILL_FIELDS } from '#gw2/professions/engineer/specializations/amalgam/catalog-fields.js';
import type { EngineerSkill } from '#gw2/professions/engineer/types.js';

export type AmalgamMorphKind = 'cleanse' | 'protect' | 'thorns' | 'demolish' | 'obliterate' | 'pierce' | 'shred';

/** Amalgam skills expose tuning declared by their module. */
export interface AmalgamSkill extends EngineerSkill, NumericSkillFields<typeof AMALGAM_SKILL_FIELDS> {
  /** Protocol identity shared across F2, F3, and F4 variants. */
  readonly morphKind?: AmalgamMorphKind;
}
