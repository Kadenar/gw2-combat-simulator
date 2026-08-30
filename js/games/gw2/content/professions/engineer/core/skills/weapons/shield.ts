/** Canonical Core engineer skill fragments grouped by their GW2 owner. */
import { ENGINEER_SKILL_IDS as ID } from '#gw2/content/professions/engineer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

/** Defines Engineer shield blocks and the palette follow-ups they arm and consume. */
export const ENGINEER_WEAPONS_SHIELD_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.MAGNETIC_SHIELD]: {
    implemented: true,
    handlerId: 'engineer.arm-flip',
    castTimeMs: 3000,
    cooldown: 20,
    effects: []
  },
  [ID.STATIC_SHIELD]: {
    implemented: true,
    handlerId: 'engineer.arm-flip',
    castTimeMs: 2500,
    cooldown: 24,
    effects: [
      {
        type: 'control',
        actorType: 'player',
        metadata: {
          controlKind: 'stun',
          duration: 1
        }
      }
    ]
  },
  [ID.THROW_SHIELD]: {
    implemented: true,
    handlerId: 'engineer.consume-flip',
    flipParentName: 'Static Shield',
    castTimeMs: 750,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        name: 'Throw Shield',
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        metadata: {
          controlKind: 'daze',
          duration: 1
        }
      }
    ]
  },
  [ID.MAGNETIC_INVERSION]: {
    implemented: true,
    handlerId: 'engineer.consume-flip',
    flipParentName: 'Magnetic Shield',
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.25,
        hits: 1,
        name: 'Magnetic Inversion',
        actorType: 'player'
      }
    ]
  }
});
