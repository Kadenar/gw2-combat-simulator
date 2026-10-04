/** Canonical Core engineer skill fragments grouped by their GW2 owner. */
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

/** Defines Engineer shield blocks and the palette follow-ups they arm and consume. */
export const ENGINEER_WEAPONS_SHIELD_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.MAGNETIC_SHIELD]: {
    // Expose the follow-up on commitment; its declaration owns the window.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipArm', skillId: ID.MAGNETIC_INVERSION, durationSec: null } }],
    paletteFlipSkillId: ID.MAGNETIC_INVERSION,
    castTimeMs: 2000,
    cooldown: 20,
    effects: []
  },
  [ID.STATIC_SHIELD]: {
    // Expose the follow-up on commitment; its declaration owns the window.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipArm', skillId: ID.THROW_SHIELD, durationSec: null } }],
    paletteFlipSkillId: ID.THROW_SHIELD,
    castTimeMs: 1680,
    cooldown: 24,
    effects: [
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'stun'
      }
    ]
  },
  [ID.THROW_SHIELD]: {
    // A committed follow-up consumes its window and restores the parent.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.THROW_SHIELD } }],
    // Availability requires the parent skill's exposed window.

    requiresArmedFlip: true,
    castTimeMs: 520,
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
        controlKind: 'daze'
      }
    ]
  },
  [ID.MAGNETIC_INVERSION]: {
    // A committed follow-up consumes its window and restores the parent.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.MAGNETIC_INVERSION } }],
    // Availability requires the parent skill's exposed window.

    requiresArmedFlip: true,
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
