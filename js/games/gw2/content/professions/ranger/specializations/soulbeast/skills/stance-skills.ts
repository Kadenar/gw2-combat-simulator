/**
 * Owns Soulbeast stance skill fragments and their handler selection.
 * Stance runtime windows remain under `execution/` and specialization mechanics.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/content/professions/ranger/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const SOULBEAST_STANCE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.VULTURE_STANCE]: {
    castTimeMs: 0,
    effects: [],
    // Custom: Opens the Vulture Stance proc window with stance-duration traits; see `soulbeast/execution/index.ts`.
    handlerId: 'ranger.vulture-stance'
  },
  [ID.BEAR_STANCE]: {
    effects: [],
    quicknessCastTimeMs: 500
  },
  [ID.ONE_WOLF_PACK]: {
    effects: [],
    quicknessCastTimeMs: 360,
    // Custom: Opens the One Wolf Pack proc window with stance-duration traits; see `soulbeast/execution/index.ts`.
    handlerId: 'ranger.one-wolf-pack'
  }
});
