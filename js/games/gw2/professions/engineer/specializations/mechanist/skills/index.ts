import { composeSkillDefinitions } from '#gw2/platform/skills/compose-definitions.js';
/**
 * Composes Mechanist signet, mech-command, and mech-attack catalogs.
 * Persistent mech state remains under `mechanics/`.
 */
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { MECHANIST_MECH_ATTACK_SKILL_MECHANICS } from '#gw2/professions/engineer/specializations/mechanist/skills/mech-attack-skills.js';
import { MECHANIST_MECH_COMMAND_SKILL_MECHANICS } from '#gw2/professions/engineer/specializations/mechanist/skills/mech-command-skills.js';
import { MECHANIST_SIGNET_SKILL_MECHANICS } from '#gw2/professions/engineer/specializations/mechanist/skills/signet-skills.js';

/** Supplies the composed Mechanist skill catalog without owning family-specific definitions. */
export const MECHANIST_SKILL_MECHANICS: Readonly<Record<string, SkillDefinition>> = composeSkillDefinitions(
  MECHANIST_SIGNET_SKILL_MECHANICS,
  MECHANIST_MECH_COMMAND_SKILL_MECHANICS,
  MECHANIST_MECH_ATTACK_SKILL_MECHANICS
);
