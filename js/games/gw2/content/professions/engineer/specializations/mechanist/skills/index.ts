/**
 * Composes Mechanist signet, mech-command, and mech-attack catalogs.
 * Persistent mech state remains under `mechanics/`.
 */
import { MECHANIST_MECH_ATTACK_SKILL_MECHANICS } from '#gw2/content/professions/engineer/specializations/mechanist/skills/mech-attack-skills.js';
import { MECHANIST_MECH_COMMAND_SKILL_MECHANICS } from '#gw2/content/professions/engineer/specializations/mechanist/skills/mech-command-skills.js';
import { MECHANIST_SIGNET_SKILL_MECHANICS } from '#gw2/content/professions/engineer/specializations/mechanist/skills/signet-skills.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

/** Supplies the composed Mechanist skill catalog without owning family-specific fragments. */
export const MECHANIST_SKILL_MECHANICS: Readonly<Record<string, SkillFragment>> = Object.freeze({
  ...MECHANIST_SIGNET_SKILL_MECHANICS,
  ...MECHANIST_MECH_COMMAND_SKILL_MECHANICS,
  ...MECHANIST_MECH_ATTACK_SKILL_MECHANICS
});
