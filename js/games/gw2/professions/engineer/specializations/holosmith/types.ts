import type { EngineerSkill } from '#gw2/professions/engineer/types.js';
import type { NumericSkillFields } from '#gw2/platform/skills/field-specs.js';
import type { HOLOSMITH_SKILL_FIELDS } from '#gw2/professions/engineer/specializations/holosmith/skill-fields.js';

/**
 * Owns skill metadata consumed only by Holosmith mechanics, keeping heat and
 * Photon Forge concerns out of the shared Engineer skill contract.
 */
export interface HolosmithSkill extends EngineerSkill, NumericSkillFields<typeof HOLOSMITH_SKILL_FIELDS> {
  readonly forgeSkill?: boolean;
}

/** Strongly types Holosmith-only fields while retaining the shared skill-fragment vocabulary. */
export type HolosmithSkillFragment = Partial<HolosmithSkill>;
