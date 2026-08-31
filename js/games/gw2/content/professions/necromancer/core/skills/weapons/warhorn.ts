/** Canonical Core necromancer skill fragments grouped by their GW2 owner. */
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/content/professions/necromancer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const NECROMANCER_WEAPONS_WARHORN_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.WAIL_OF_DOOM]: {
    implemented: true,
    quicknessCastTimeMs: 1000,
    effects: [
      {
        type: 'control',
        metadata: {
          controlKind: 'fear'
        }
      }
    ]
  },
  [ID.LOCUST_SWARM]: {
    implemented: true,
    quicknessCastTimeMs: 440,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 0 }],
        name: 'Locust Swarm — Life Siphon',
        metadata: {
          flatStrikeBase: 37,
          flatStrikePowerCoeff: 0.012,
          noCrit: true,
          damageKind: 'life-steal'
        },
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 500, coefficient: 0 }],
        name: 'Locust Swarm — Life Siphon',
        metadata: {
          flatStrikeBase: 37,
          flatStrikePowerCoeff: 0.012,
          noCrit: true,
          damageKind: 'life-steal'
        },
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 1000, coefficient: 0 }],
        name: 'Locust Swarm — Life Siphon',
        metadata: {
          flatStrikeBase: 37,
          flatStrikePowerCoeff: 0.012,
          noCrit: true,
          damageKind: 'life-steal'
        },
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 1500, coefficient: 0 }],
        name: 'Locust Swarm — Life Siphon',
        metadata: {
          flatStrikeBase: 37,
          flatStrikePowerCoeff: 0.012,
          noCrit: true,
          damageKind: 'life-steal'
        },
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 2000, coefficient: 0 }],
        name: 'Locust Swarm — Life Siphon',
        metadata: {
          flatStrikeBase: 37,
          flatStrikePowerCoeff: 0.012,
          noCrit: true,
          damageKind: 'life-steal'
        },
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 2500, coefficient: 0 }],
        name: 'Locust Swarm — Life Siphon',
        metadata: {
          flatStrikeBase: 37,
          flatStrikePowerCoeff: 0.012,
          noCrit: true,
          damageKind: 'life-steal'
        },
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 3000, coefficient: 0 }],
        name: 'Locust Swarm — Life Siphon',
        metadata: {
          flatStrikeBase: 37,
          flatStrikePowerCoeff: 0.012,
          noCrit: true,
          damageKind: 'life-steal'
        },
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 3500, coefficient: 0 }],
        name: 'Locust Swarm — Life Siphon',
        metadata: {
          flatStrikeBase: 37,
          flatStrikePowerCoeff: 0.012,
          noCrit: true,
          damageKind: 'life-steal'
        },
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 4000, coefficient: 0 }],
        name: 'Locust Swarm — Life Siphon',
        metadata: {
          flatStrikeBase: 37,
          flatStrikePowerCoeff: 0.012,
          noCrit: true,
          damageKind: 'life-steal'
        },
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 4500, coefficient: 0 }],
        name: 'Locust Swarm — Life Siphon',
        metadata: {
          flatStrikeBase: 37,
          flatStrikePowerCoeff: 0.012,
          noCrit: true,
          damageKind: 'life-steal'
        },
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    lifeForceGain: 1.5
  }
});
