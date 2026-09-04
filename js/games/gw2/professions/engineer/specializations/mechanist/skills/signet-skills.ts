/**
 * Owns Mechanist signet skill fragments.
 * Mech commands and autonomous attack identities live in their named catalogs.
 */
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

/** Supplies Mechanist signet fragments to specialization composition. */
export const MECHANIST_SIGNET_SKILL_MECHANICS: Readonly<Record<string, SkillFragment>> = Object.freeze({
  [ID.RECTIFIER_SIGNET]: {
    castTimeMs: 750,
    cooldown: 30,
    effects: []
  },
  [ID.OVERCLOCK_SIGNET]: {
    // Custom: Resets mech command cooldowns and schedules Overclock behavior; see `mechanist/mechanics/mech.ts`.
    handlerId: 'engineer.overclock-signet',
    castTimeMs: 0,
    cooldown: 90,
    effects: []
  },
  [ID.SHIFT_SIGNET]: {
    castTimeMs: 0,
    cooldown: 25,
    effects: []
  },
  [ID.SUPERCONDUCTING_SIGNET]: {
    castTimeMs: 750,
    cooldown: 30,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 6 }, (_, index) => ({
          atMs: 86.666666666667 + index * 86.666666666667,
          coefficient: 14.399999999999999 / 6
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Superconducting Signet',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 6,
        duration: 3,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Confusion',
        stacks: 6,
        duration: 3,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 6,
        duration: 3,
        actorType: 'player'
      }
    ]
  },
  [ID.FORCE_SIGNET]: {
    castTimeMs: 750,
    cooldown: 30,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Force Signet',
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'knockback',
        duration: 240
      }
    ]
  },
  [ID.BARRIER_SIGNET]: {
    castTimeMs: 500,
    cooldown: 30,
    effects: []
  }
});
