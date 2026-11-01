/** Explicit Evoker follow-ups; their owning mechanics control activation and expiry. */
import type { SkillFlips } from '#gw2/platform/skills/skill-flip-definitions.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';

export const ELEMENTALIST_EVOKER_SKILL_FLIPS: SkillFlips = Object.freeze([
  { parentId: ID.IGNITE, followUpId: ID.CONFLAGRATION },
  { parentId: ID.SPLASH, followUpId: ID.BUOYANT_DELUGE },
  { parentId: ID.ZAP, followUpId: ID.LIGHTNING_BLITZ },
  { parentId: ID.CALCIFY, followUpId: ID.SEISMIC_IMPACT }
]);
