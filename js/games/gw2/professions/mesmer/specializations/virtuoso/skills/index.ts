/**
 * Owns Virtuoso slot-skill and bladesong catalog fragments only.
 * Blade storage and bladesong runtime behavior lives under `mechanics/`.
 */
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { SkillFragment, SkillId } from '#gw2/platform/engine/skills/types.js';

export const MESMER_VIRTUOSO_SKILL_MECHANICS: Readonly<Record<SkillId, SkillFragment>> = Object.freeze({
  [ID.THOUSAND_CUTS]: {
    castTimeMs: 0,
    blade: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 0,
            coefficient: 0.5
          },
          {
            atMs: 520,
            coefficient: 0.5
          },
          {
            atMs: 1040,
            coefficient: 0.5
          },
          {
            atMs: 1560,
            coefficient: 0.5
          },
          {
            atMs: 2080,
            coefficient: 0.5
          },
          {
            atMs: 2600,
            coefficient: 0.5
          },
          {
            atMs: 3120,
            coefficient: 0.5
          },
          {
            atMs: 3640,
            coefficient: 0.5
          },
          {
            atMs: 4160,
            coefficient: 0.5
          },
          {
            atMs: 4680,
            coefficient: 0.5
          }
        ],
        name: 'Damage',
        actorType: 'player',
        weapon: 'unequipped',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.SWORD_OF_DECIMATION]: {
    castTimeMs: 333.333333333,
    blade: true,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: 'Damage',
        actorType: 'player',
        weapon: 'utility'
      }
    ]
  },
  [ID.BLADE_RENEWAL]: {
    castTimeMs: 1333.333333333,
    resource: {
      mode: 'fill',
      count: 5
    },
    blade: true,
    effects: []
  },
  [ID.RAIN_OF_SWORDS]: {
    castTimeMs: 680,
    blade: true,
    effects: [
      {
        type: 'strike',
        // Rain begins after the ground-target delay observed in EVTC, then pulses once per second.
        ticks: [840, 1840, 2840, 3840, 4840].map((atMs) => ({
          atMs,
          coefficient: 1.2
        })),
        name: 'Damage',
        actorType: 'player',
        weapon: 'utility',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [840, 1840, 2840, 3840, 4840].map((atMs) => ({
          atMs,
          condition: 'Vulnerability',
          stacks: 3,
          duration: 10
        })),
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.TWIN_BLADE_RESTORATION]: {
    castTimeMs: 666.666666667,
    blade: true,
    effects: [
      {
        type: 'strike',
        coefficient: 0.7,
        hits: 2,
        atMs: 0,
        name: 'Damage',
        actorType: 'player',
        weapon: 'unequipped'
      }
    ]
  },
  [ID.BLADETURN_REQUIEM]: {
    castTimeMs: 0,
    lockouts: [
      {
        group: 'mesmer.shatter',
        durationMs: 50
      }
    ],
    blade: true,
    effects: []
  },
  [ID.BLADESONG_DISSONANCE]: {
    castTimeMs: 480,
    lockouts: [
      {
        group: 'mesmer.shatter',
        durationMs: 50
      }
    ],
    blade: true,
    effects: [
      {
        type: 'control',
        source: 'Player',
        controlKind: 'daze',
        actorType: 'player',
        atMs: 0,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.BLADESONG_SORROW]: {
    castTimeMs: 480,
    lockouts: [
      {
        group: 'mesmer.shatter',
        durationMs: 50
      }
    ],
    blade: true,
    effects: []
  },
  [ID.BLADESONG_HARMONY]: {
    castTimeMs: 640,
    interruptCommitMs: 560,
    retainsCastLockoutAfterInterrupt: true,
    lockouts: [
      {
        group: 'mesmer.shatter',
        durationMs: 50
      }
    ],
    blade: true,
    effects: []
  },
  [ID.BLADESONG_DISTORTION]: {
    castTimeMs: 0,
    lockouts: [
      {
        group: 'mesmer.shatter',
        durationMs: 50
      }
    ],
    rechargeAnchor: 'castStart',
    blade: true,
    effects: []
  }
});
