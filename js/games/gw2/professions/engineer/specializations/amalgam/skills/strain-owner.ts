import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import { AMALGAM_MORPH_KIND_BY_SKILL_ID } from '#gw2/professions/engineer/specializations/amalgam/selection-policy.js';
import type { SkillId } from '#gw2/platform/skills/types.js';

/** Persistent strains share one payload and cooldown across protocol slots and retained grants. */
export function amalgamStrainOwnerId(skillId: SkillId): SkillId {
  const kind = AMALGAM_MORPH_KIND_BY_SKILL_ID.get(skillId);
  return kind === 'thorns'
    ? ID.DEFENSIVE_PROTOCOL_THORNS
    : kind === 'obliterate'
      ? ID.OFFENSIVE_PROTOCOL_OBLITERATE
      : skillId;
}
