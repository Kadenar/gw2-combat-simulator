/**
 * Owns Soulbeast mode-toggle and pet-swap action fragments.
 * Persistent merge state and transitions remain in `mechanics/beastmode.ts` and `live.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

// Entering and leaving Beastmode are two states of the same F5 palette tile.
const BEASTMODE_PALETTE_TILE = 'ranger-soulbeast-beastmode-toggle';

export const SOULBEAST_BEASTMODE_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.BEASTMODE]: {
    castTimeMs: 0,
    paletteTileId: BEASTMODE_PALETTE_TILE,
    paletteTileOrder: 1,
    effects: [],
    // Custom: Enters Beastmode, disables the pet actor, and applies toggle traits; see `soulbeast/live.ts`.
    inputCategory: 'bar-swap' // Count the explicit bar-changing input in effort summaries.
  },
  [ID.LEAVE_BEASTMODE]: {
    castTimeMs: 0,
    paletteTileId: BEASTMODE_PALETTE_TILE,
    paletteTileOrder: 2,
    effects: [],
    // Custom: Leaves Beastmode, restores the pet actor, and applies toggle traits; see `soulbeast/live.ts`.
    inputCategory: 'bar-swap' // Count the explicit bar-changing input in effort summaries.
  },
  [ID.ETERNAL_BOND]: {
    castTimeMs: 0,
    effects: []
  }
});
