/** Canonical Core mesmer skill fragments grouped by their GW2 owner. */
import { MESMER_SKILL_IDS as ID } from '#gw2/content/professions/mesmer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const MESMER_WEAPONS_SCEPTER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.CONFUSING_IMAGES]: {
    interruptMode: 'per-packet',
    type: 'Weapon',
    weapon: 'Scepter',
    specialization: '',
    cooldown: 9,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 921, coefficient: 0.76 },
          { atMs: 1081, coefficient: 0.76 },
          { atMs: 1199, coefficient: 0.76 },
          { atMs: 1441, coefficient: 0.76 },
          { atMs: 1560, coefficient: 0.76 },
          { atMs: 1679, coefficient: 0.76 },
          { atMs: 1841, coefficient: 0.76 }
        ],
        name: 'Damage',
        actorType: 'player',
        weapon: 'scepter',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'confusion',
        duration: 7,
        stacks: 7
      }
    ],
    quicknessCastTimeMs: 1920,
    pulseCount: 7
  },
  [ID.ILLUSIONARY_COUNTER]: {
    type: 'Weapon',
    weapon: 'Scepter',
    specialization: '',
    quicknessCastTimeMs: 1200,
    cooldown: 6,
    effects: [],
    defaultInterruptMs: 120,
    interruptCommitMs: 120
  },
  [ID.ETHER_BOLT]: {
    type: 'Weapon',
    weapon: 'Scepter',
    specialization: '',
    cooldown: 0,
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
    castTimeMs: 660
  },
  [ID.ETHER_BLAST]: {
    type: 'Weapon',
    weapon: 'Scepter',
    specialization: '',
    castTimeMs: 780,
    cooldown: 0,
    nextChainId: ID.ETHER_CLONE,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 481, coefficient: 0.5 }],
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
    type: 'Weapon',
    weapon: 'Scepter',
    specialization: '',
    quicknessCastTimeMs: 840,
    cooldown: 0,
    // Ether Clone creates its clone with the projectile hit; interruptions before that packet grant no clone.
    resource: {
      mode: 'add',
      count: 1,
      timingAnchor: 'castStart',
      atMs: 442
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
        ticks: [{ atMs: 442, coefficient: 0.75 }],
        name: 'Damage',
        actorType: 'player',
        weapon: 'scepter',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  }
});
