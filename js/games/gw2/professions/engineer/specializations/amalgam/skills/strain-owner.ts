import type { SkillId } from '#gw2/platform/skills/types.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { AmalgamSkill } from '#gw2/professions/engineer/specializations/amalgam/types.js';

/** Persistent strains share one payload and cooldown across protocol slots and retained grants. */
export function amalgamStrainOwnerId(skill: AmalgamSkill): SkillId {
  const kind = skill.morphKind;
  return kind === 'thorns'
    ? ID.DEFENSIVE_PROTOCOL_THORNS
    : kind === 'obliterate'
      ? ID.OFFENSIVE_PROTOCOL_OBLITERATE
      : skill.id;
}
