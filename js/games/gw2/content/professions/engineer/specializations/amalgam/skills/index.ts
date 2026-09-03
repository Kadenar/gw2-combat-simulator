/**
 * Composes Amalgam protocol and evolved-state skill catalogs.
 * Persistent strain and morph state remain under `mechanics/`.
 */
import { AMALGAM_EVOLVED_STATE_SKILL_MECHANICS } from '#gw2/content/professions/engineer/specializations/amalgam/skills/evolved-state-skills.js';
import { AMALGAM_PROTOCOL_SKILL_MECHANICS } from '#gw2/content/professions/engineer/specializations/amalgam/skills/protocol-skills.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

/** Supplies the composed Amalgam skill catalog without owning family-specific fragments. */
export const AMALGAM_SKILL_MECHANICS: Readonly<Record<string, SkillFragment>> = Object.freeze({
  ...AMALGAM_PROTOCOL_SKILL_MECHANICS,
  ...AMALGAM_EVOLVED_STATE_SKILL_MECHANICS
});
