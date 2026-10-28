/**
 * Composes Amalgam protocol and evolved-state skill catalogs.
 * Persistent strain and morph state remain under `mechanics/`.
 */
import type { Skill } from '#gw2/platform/skills/types.js';
import { AMALGAM_EVOLVED_STATE_SKILL_MECHANICS } from '#gw2/professions/engineer/specializations/amalgam/skills/evolved-state-skills.js';
import { AMALGAM_PROTOCOL_SKILL_MECHANICS } from '#gw2/professions/engineer/specializations/amalgam/skills/protocol-skills.js';

/** Supplies the composed Amalgam skill catalog without owning family-specific fragments. */
export const AMALGAM_SKILL_MECHANICS: Readonly<Record<string, Partial<Skill>>> = Object.freeze({
  ...AMALGAM_PROTOCOL_SKILL_MECHANICS,
  ...AMALGAM_EVOLVED_STATE_SKILL_MECHANICS
});
