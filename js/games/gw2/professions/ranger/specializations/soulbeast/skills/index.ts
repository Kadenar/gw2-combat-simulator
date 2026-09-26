/**
 * Composes Soulbeast stance, Beastmode action, and merged-pet skill catalogs.
 * Runtime merge behavior remains in `mechanics/` and `live.ts`.
 */
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { SOULBEAST_BEAST_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/soulbeast/skills/beast-skills/index.js';
import { SOULBEAST_BEASTMODE_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/soulbeast/skills/beastmode-skills.js';
import { SOULBEAST_STANCE_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/soulbeast/skills/stance-skills.js';

export const SOULBEAST_BASE_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  ...SOULBEAST_BEAST_SKILL_MECHANICS,
  ...SOULBEAST_BEASTMODE_SKILL_MECHANICS,
  ...SOULBEAST_STANCE_SKILL_MECHANICS
});
