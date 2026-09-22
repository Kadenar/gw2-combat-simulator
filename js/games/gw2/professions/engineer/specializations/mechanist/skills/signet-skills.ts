/**
 * Owns Mechanist signet skill fragments.
 * Mech commands and autonomous attack identities live in their named catalogs.
 */
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

/** Supplies Mechanist signet fragments to specialization composition. */
export const MECHANIST_SIGNET_SKILL_MECHANICS: Readonly<Record<string, Partial<Skill>>> = Object.freeze({
  [ID.RECTIFIER_SIGNET]: {
    castTimeMs: 520,
    cooldown: 30,
    effects: []
  },
  [ID.OVERCLOCK_SIGNET]: {
    // Orders the active mech to channel Jade Buster Cannon; see `mechanist/mechanics/mech.ts`.
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
    castTimeMs: 880,
    interruptCommitMs: 560,
    cooldown: 30,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        ticks: Array.from({ length: 6 }, (_, index) => ({ atMs: 560 + index * 1000, coefficient: 2.4 / 6 })),
        intervalTimingScale: 'fixed',
        comboFields: [{ ownerId: 'engineer', fieldType: 'Lightning', duration: 5, startAnchor: 'event' }],
        name: 'Superconducting Signet',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        atMs: 560,
        applications: 6,
        intervalMs: 1000,
        intervalTimingScale: 'fixed',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Confusion',
        atMs: 560,
        applications: 6,
        intervalMs: 1000,
        intervalTimingScale: 'fixed',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Burning',
        atMs: 560,
        applications: 6,
        intervalMs: 1000,
        intervalTimingScale: 'fixed',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      }
    ])
  },
  [ID.FORCE_SIGNET]: {
    castTimeMs: 520,
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
        controlKind: 'knockback'
      }
    ]
  },
  [ID.BARRIER_SIGNET]: {
    castTimeMs: 360,
    cooldown: 30,
    effects: []
  }
});
