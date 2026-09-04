/** Composes Renegade warband and order skill catalogs. */
import { RENEGADE_ORDER_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/renegade/skills/order-skills.js';
import { RENEGADE_WARBAND_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/renegade/skills/warband-skills.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

/** Preserves one public aggregate while named Renegade families own each fragment. */
export const RENEGADE_BASE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  ...RENEGADE_WARBAND_SKILL_MECHANICS,
  ...RENEGADE_ORDER_SKILL_MECHANICS
});
