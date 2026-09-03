/**
 * Owns Soulbeast mode-toggle and pet-swap action fragments.
 * Persistent merge state and transitions remain in `mechanics/beastmode.ts` and `execution/index.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/content/professions/ranger/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

// Entering and leaving Beastmode are two states of the same F5 palette tile.
const BEASTMODE_PALETTE_TILE = 'ranger-soulbeast-beastmode-toggle';

export const SOULBEAST_BEASTMODE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.BEASTMODE]: {
    castTimeMs: 0,
    paletteTileId: BEASTMODE_PALETTE_TILE,
    paletteTileOrder: 1,
    effects: [],
    // Custom: Enters Beastmode, disables the pet actor, and applies toggle traits; see `soulbeast/execution/index.ts`.
    handlerId: 'ranger.beastmode-enter'
  },
  [ID.LEAVE_BEASTMODE]: {
    castTimeMs: 0,
    paletteTileId: BEASTMODE_PALETTE_TILE,
    paletteTileOrder: 2,
    effects: [],
    // Custom: Leaves Beastmode, restores the pet actor, and applies toggle traits; see `soulbeast/execution/index.ts`.
    handlerId: 'ranger.beastmode-exit'
  },
  [ID.ETERNAL_BOND]: {
    castTimeMs: 0,
    effects: []
  }
});
