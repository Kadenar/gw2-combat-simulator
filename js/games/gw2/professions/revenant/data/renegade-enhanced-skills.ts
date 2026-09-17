import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';

/** Maps each Renegade warband skill to its Band Together enhanced variant. */
export const RENEGADE_ENHANCED_SKILL_BY_ID: Readonly<Record<number, SkillId>> = Object.freeze({
  [ID.ICERAZORS_IRE]: ID.ICERAZORS_IRE_ID_72359,
  [ID.RAZORCLAWS_RAGE]: ID.RAZORCLAWS_RAGE_ID_72363,
  [ID.DARKRAZORS_DARING]: ID.DARKRAZORS_DARING_ID_72366,
  [ID.BREAKRAZORS_BASTION]: ID.BREAKRAZORS_BASTION_ID_72389
});
