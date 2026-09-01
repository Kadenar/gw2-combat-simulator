/** Canonical Core mesmer skill fragments grouped by their GW2 owner. */
import { MESMER_SKILL_IDS as ID } from '#gw2/content/professions/mesmer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const MESMER_WEAPONS_DAGGER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.FLYING_CUTTER]: {
    implemented: true,
    type: 'Weapon',
    weapon: 'Dagger',
    specialization: '',
    castTimeMs: 660,
    interruptCommitMs: 380,
    cooldown: 0,
    blade: true,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        name: 'Projectile',
        actorType: 'player',
        castProgress: 0.72
      }
    ],
    trackedHitDamage: {
      hitsRequired: 3,
      duration: 5,
      skillId: ID.CUTTER_BURST,
      name: 'Cutter Burst',
      actorType: 'player',
      // A third landed projectile commits Cutter Burst even when Flying Cutter's remaining animation is interrupted.
      persistsAfterInterrupt: true,
      ticks: [
        {
          atMs: 217,
          coefficient: 0.2
        },
        {
          atMs: 250,
          coefficient: 0.2
        },
        {
          atMs: 384,
          coefficient: 0.2
        }
      ]
    }
  },
  [ID.UNSTABLE_BLADESTORM]: {
    implemented: true,
    type: 'Weapon',
    weapon: 'Dagger',
    specialization: '',
    quicknessCastTimeMs: 440,
    cooldown: 12,
    blade: true,
    // The storm commits 200ms into a Quickness cast; its four pulse pairs then persist after interruption.
    interruptCommitMs: 200,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 1160, coefficient: 0.25 },
          { atMs: 2160, coefficient: 0.25 },
          { atMs: 3160, coefficient: 0.25 },
          { atMs: 4160, coefficient: 0.25 }
        ],
        name: 'Storm pulses',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'strike',
        ticks: [
          { atMs: 1200, coefficient: 0.5 },
          { atMs: 2200, coefficient: 0.5 },
          { atMs: 3200, coefficient: 0.5 },
          { atMs: 4200, coefficient: 0.5 }
        ],
        name: 'Launched blades',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      }
    ]
  },
  [ID.BLADECALL]: {
    implemented: true,
    type: 'Weapon',
    weapon: 'Dagger',
    specialization: '',
    cooldown: 5,
    resource: {
      mode: 'add',
      count: 1,
      timingAnchor: 'castStart',
      atMs: 199
    },
    blade: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 199,
            coefficient: 0.25
          },
          {
            atMs: 199,
            coefficient: 0.25
          },
          {
            atMs: 199,
            coefficient: 0.25
          }
        ],
        name: 'Outgoing damage',
        actorType: 'player',
        weapon: 'dagger',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 2716,
            coefficient: 0.25
          },
          {
            atMs: 2716,
            coefficient: 0.25
          },
          {
            atMs: 2766,
            coefficient: 0.25
          }
        ],
        name: 'Returning damage',
        actorType: 'player',
        weapon: 'dagger',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    castTimeMs: 660
  }
});
