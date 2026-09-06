/**
 * Owns Luminary Radiant Virtue skill fragments.
 * Persistent virtue state and behavior remain under Core and Luminary mechanics.
 */
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const LUMINARY_VIRTUE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.RADIANT_COURAGE]: {
    castTimeMs: 0,
    // Custom: Activates the virtue and updates passive/readiness state; see `core/mechanics/virtues.ts`.
    handlerId: 'guardian.virtue',
    // Courage's activation grants these boons to the player and nearby allies.
    effects: [
      { type: 'boon', boon: 'aegis', duration: 20, audience: { recipients: 'party' } },
      { type: 'boon', boon: 'resistance', duration: 4, audience: { recipients: 'party' } }
    ]
  },
  [ID.RADIANT_RESOLVE]: {
    castTimeMs: 0,
    // Custom: Activates the virtue and updates passive/readiness state; see `core/mechanics/virtues.ts`.
    handlerId: 'guardian.virtue',
    effects: []
  },
  [ID.RADIANT_JUSTICE]: {
    castTimeMs: 0,
    // Custom: Activates the virtue and updates passive/readiness state; see `core/mechanics/virtues.ts`.
    handlerId: 'guardian.virtue',
    effects: []
  }
});
