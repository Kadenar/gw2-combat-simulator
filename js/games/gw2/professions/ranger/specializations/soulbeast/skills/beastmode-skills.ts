import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

/**
 * Owns Soulbeast mode-toggle and pet-swap action definitions.
 * Persistent merge state and transitions belong to `mechanics/beastmode-effects.ts`.
 */

// Entering and leaving Beastmode are two states of the same F5 palette tile.
const BEASTMODE_PALETTE_TILE = 'ranger-soulbeast-beastmode-toggle';

export const SOULBEAST_BEASTMODE_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.BEASTMODE]: {
    name: 'Beastmode',
    description: 'Meld with your pet.',
    icon: 'https://render.guildwars2.com/file/905547F3499034F4680ADB272DE01FD2D45506DB/1770050.png',
    type: 'Profession',
    slot: 'Profession_5',
    cooldown: 10,
    beastmodeSkill: true,
    paletteTileId: BEASTMODE_PALETTE_TILE,
    paletteTileOrder: 1,
    inputCategory: 'bar-swap',
    // Count the explicit bar-changing input in effort summaries.
    castTimeMs: 0,
    effects: [],
    // Merge state and pet lifetime change before the transition's trait observer.
    sideEffects: [
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'ranger.beastmode-enter' } }
    ]
  },
  [ID.LEAVE_BEASTMODE]: {
    name: 'Leave Beastmode',
    description: 'Separate from your pet.',
    icon: 'https://render.guildwars2.com/file/A331029A005037D1FA0470C66F802D5901502CF6/1770051.png',
    type: 'Profession',
    slot: 'Profession_5',
    cooldown: 0,
    beastmodeSkill: true,
    paletteTileId: BEASTMODE_PALETTE_TILE,
    paletteTileOrder: 2,
    inputCategory: 'bar-swap',
    // Count the explicit bar-changing input in effort summaries.
    castTimeMs: 0,
    effects: [],
    // Merge state and pet lifetime change before the transition's trait observer.
    sideEffects: [
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'ranger.beastmode-leave' } }
    ]
  }
});
