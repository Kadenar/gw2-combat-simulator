import type { RangerRuntime } from '#gw2/professions/ranger/types.js';
import { soulbeastState } from '#gw2/professions/ranger/specializations/soulbeast/state.js';
import { setRangerPetActive } from '#gw2/professions/ranger/core/mechanics/pets.js';
import { applyUnstoppableUnion } from '#gw2/professions/ranger/specializations/soulbeast/traits/index.js';
/**
 * Owns Soulbeast mode-toggle and pet-swap action fragments.
 * Persistent merge state and transitions remain in `mechanics/beastmode-effects.ts` and `hooks.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

// Entering and leaving Beastmode are two states of the same F5 palette tile.
const BEASTMODE_PALETTE_TILE = 'ranger-soulbeast-beastmode-toggle';

export const SOULBEAST_BEASTMODE_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.BEASTMODE]: {
    // Merge state and pet generation change before the transition's trait observer.
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
    // Merge state and pet generation change before the transition's trait observer.
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

/** Keep merge, pet lifetime, and Unstoppable Union in one ordered transition. */
export function setBeastmode(runtime: RangerRuntime, skill: Skill, active: boolean): void {
  soulbeastState.from(runtime).beastmodeActive = active;
  setRangerPetActive(runtime, !active);
  applyUnstoppableUnion(runtime, skill);
}
