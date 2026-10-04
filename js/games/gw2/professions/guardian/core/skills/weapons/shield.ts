/** Canonical Core guardian skill fragments grouped by their GW2 owner. */
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

export const GUARDIAN_WEAPONS_SHIELD_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.SHIELD_OF_JUDGMENT]: {
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      }
    ]
  },
  [ID.SHIELD_OF_ABSORPTION]: {
    // Expose the follow-up on commitment; its declaration owns the window.
    sideEffects: [
      { on: 'castCommit', do: { type: 'flipArm', skillId: ID.SHIELD_OF_ABSORPTION_ID_DETONATE, expiryPriority: -220 } }
    ],
    castTimeMs: 520,
    // Detonation stays available while the dome lasts.
    flipDuration: 4,
    effects: []
  },
  [ID.SHIELD_OF_ABSORPTION_ID_DETONATE]: {
    // A committed follow-up consumes its window and restores the parent.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.SHIELD_OF_ABSORPTION_ID_DETONATE } }],
    castTimeMs: 520,
    effects: []
  },
  [ID.SHIELD_OF_JUDGMENT_ID_15834]: {
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      }
    ]
  }
});
