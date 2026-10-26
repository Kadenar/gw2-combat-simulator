import { ACTOR, CONTROL } from '#gw2/platform/constants.js';
/** Canonical Core engineer skill fragments grouped by their GW2 owner. */
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

/** Defines Engineer shield blocks and the palette follow-ups they arm and consume. */
export const ENGINEER_WEAPONS_SHIELD_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.MAGNETIC_SHIELD]: {
    cooldown: 20,
    castTimeMs: 2000,
    effects: [],
    // Expose the follow-up on commitment; its declaration owns the window.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipArm', skillId: ID.MAGNETIC_INVERSION, durationSec: null } }]
  },
  [ID.MAGNETIC_INVERSION]: {
    // Availability requires the parent skill's exposed window.

    requiresArmedFlip: true,
    cooldown: 0,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.25,
        hits: 1,
        name: 'Magnetic Inversion',
        actorType: ACTOR.PLAYER
      }
    ],
    // A committed follow-up consumes its window and restores the parent.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.MAGNETIC_INVERSION } }]
  },
  [ID.STATIC_SHIELD]: {
    cooldown: 24,
    castTimeMs: 1680,
    effects: [
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.STUN
      }
    ],
    // Expose the follow-up on commitment; its declaration owns the window.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipArm', skillId: ID.THROW_SHIELD, durationSec: null } }]
  },
  [ID.THROW_SHIELD]: {
    // Availability requires the parent skill's exposed window.

    requiresArmedFlip: true,
    cooldown: 0,
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        name: 'Throw Shield',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.DAZE
      }
    ],
    // A committed follow-up consumes its window and restores the parent.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.THROW_SHIELD } }]
  }
});
