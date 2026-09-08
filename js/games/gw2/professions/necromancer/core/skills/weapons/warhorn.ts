/** Canonical Core necromancer skill fragments grouped by their GW2 owner. */
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const NECROMANCER_WEAPONS_WARHORN_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.WAIL_OF_DOOM]: {
    quicknessCastTimeMs: 1000,
    effects: [
      {
        type: 'control',
        controlKind: 'fear'
      }
    ]
  },
  [ID.LOCUST_SWARM]: {
    quicknessCastTimeMs: 440,
    // Round each original half-second pulse to 40 ms; keep whole-second pulses in place to avoid cumulative drift.
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 0 }],
        name: 'Locust Swarm — Life Siphon',
        flatStrikeBase: 37,
        flatStrikePowerCoeff: 0.012,
        noCrit: true,
        damageKind: 'life-steal',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 520, coefficient: 0 }],
        name: 'Locust Swarm — Life Siphon',
        flatStrikeBase: 37,
        flatStrikePowerCoeff: 0.012,
        noCrit: true,
        damageKind: 'life-steal',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 1000, coefficient: 0 }],
        name: 'Locust Swarm — Life Siphon',
        flatStrikeBase: 37,
        flatStrikePowerCoeff: 0.012,
        noCrit: true,
        damageKind: 'life-steal',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 1520, coefficient: 0 }],
        name: 'Locust Swarm — Life Siphon',
        flatStrikeBase: 37,
        flatStrikePowerCoeff: 0.012,
        noCrit: true,
        damageKind: 'life-steal',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 2000, coefficient: 0 }],
        name: 'Locust Swarm — Life Siphon',
        flatStrikeBase: 37,
        flatStrikePowerCoeff: 0.012,
        noCrit: true,
        damageKind: 'life-steal',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 2520, coefficient: 0 }],
        name: 'Locust Swarm — Life Siphon',
        flatStrikeBase: 37,
        flatStrikePowerCoeff: 0.012,
        noCrit: true,
        damageKind: 'life-steal',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 3000, coefficient: 0 }],
        name: 'Locust Swarm — Life Siphon',
        flatStrikeBase: 37,
        flatStrikePowerCoeff: 0.012,
        noCrit: true,
        damageKind: 'life-steal',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 3520, coefficient: 0 }],
        name: 'Locust Swarm — Life Siphon',
        flatStrikeBase: 37,
        flatStrikePowerCoeff: 0.012,
        noCrit: true,
        damageKind: 'life-steal',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 4000, coefficient: 0 }],
        name: 'Locust Swarm — Life Siphon',
        flatStrikeBase: 37,
        flatStrikePowerCoeff: 0.012,
        noCrit: true,
        damageKind: 'life-steal',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 4520, coefficient: 0 }],
        name: 'Locust Swarm — Life Siphon',
        flatStrikeBase: 37,
        flatStrikePowerCoeff: 0.012,
        noCrit: true,
        damageKind: 'life-steal',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    lifeForceGain: 1.5
  }
});
