import type { Skill } from '#gw2/platform/skills/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

/**
 * Owns Soulbeast mode-toggle and pet-swap action fragments.
 * Persistent merge state and transitions belong to `mechanics/beastmode-effects.ts`.
 */

// Entering and leaving Beastmode are two states of the same F5 palette tile.
const BEASTMODE_PALETTE_TILE = 'ranger-soulbeast-beastmode-toggle';

export const SOULBEAST_BEASTMODE_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.BEASTMODE]: {
    // Merge state and pet lifetime change before the transition's trait observer.
    sideEffects: [
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'ranger.beastmode-enter' } }
    ],
    castTimeMs: 0,
    paletteTileId: BEASTMODE_PALETTE_TILE,
    paletteTileOrder: 1,
    effects: [],
    inputCategory: 'bar-swap' // Count the explicit bar-changing input in effort summaries.
  },
  [ID.LEAVE_BEASTMODE]: {
    // Merge state and pet lifetime change before the transition's trait observer.
    sideEffects: [
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'ranger.beastmode-leave' } }
    ],
    castTimeMs: 0,
    paletteTileId: BEASTMODE_PALETTE_TILE,
    paletteTileOrder: 2,
    effects: [],
    inputCategory: 'bar-swap' // Count the explicit bar-changing input in effort summaries.
  }
});
