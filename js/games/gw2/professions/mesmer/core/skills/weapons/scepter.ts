/** Canonical Core mesmer skill fragments grouped by their GW2 owner. */
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const MESMER_WEAPONS_SCEPTER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.CONFUSING_IMAGES]: {
    interruptMode: 'per-packet',
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 920, coefficient: 0.76 },
          { atMs: 1080, coefficient: 0.76 },
          { atMs: 1200, coefficient: 0.76 },
          { atMs: 1440, coefficient: 0.76 },
          { atMs: 1560, coefficient: 0.76 },
          { atMs: 1680, coefficient: 0.76 },
          { atMs: 1840, coefficient: 0.76 }
        ],
        name: 'Damage',
        actorType: 'player',
        weapon: 'scepter',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        // Confusion applies once per channel pulse, independently of the strike packet cadence.
        ticks: [280, 560, 840, 1080, 1360, 1640, 1920].map((atMs) => ({
          atMs,
          condition: 'confusion',
          duration: 7,
          stacks: 1
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    castTimeMs: 1920
  },
  [ID.ILLUSIONARY_COUNTER]: {
    castTimeMs: 1200,
    effects: [],
    defaultInterruptMs: 120,
    interruptCommitMs: 80
  },
  [ID.ETHER_BOLT]: {
    nextChainId: ID.ETHER_BLAST,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 400, coefficient: 0.5 }],
        name: 'Damage',
        actorType: 'player',
        weapon: 'scepter',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'torment',
        duration: 4,
        stacks: 1
      }
    ],
    castTimeMs: 440
  },
  [ID.ETHER_BLAST]: {
    castTimeMs: 520,
    nextChainId: ID.ETHER_CLONE,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 480, coefficient: 0.5 }],
        name: 'Damage',
        actorType: 'player',
        weapon: 'scepter',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Torment',
        duration: 6,
        stacks: 1
      }
    ]
  },
  [ID.ETHER_CLONE]: {
    interruptCommitMs: 440,
    castTimeMs: 840,
    // Ether Clone creates its clone with the projectile hit; interruptions before that packet grant no clone.
    resource: {
      mode: 'add',
      count: 1,
      timingAnchor: 'castStart',
      atMs: 440
    },
    maxCloneEffects: [
      {
        type: 'condition',
        condition: 'Torment',
        duration: 9,
        stacks: 1
      }
    ],
    nextChainId: null,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 440, coefficient: 0.75 }],
        name: 'Damage',
        actorType: 'player',
        weapon: 'scepter',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  }
});
