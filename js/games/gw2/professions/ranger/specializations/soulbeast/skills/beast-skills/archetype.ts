/**
 * Owns Soulbeast merged-pet skill fragments for the Archetype family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

// ponytail: approximate channel pulses on the nominal cast timeline until merged-skill measurements are available.
const PRIMAL_CRY_PULSES_MS = [160, 520, 840];

export const SOULBEAST_ARCHETYPE_BEAST_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.PRIMAL_CRY]: {
    // Each surviving pulse deals damage before applying its own poison, bleeding, and vulnerability.
    interruptMode: 'per-packet',
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: PRIMAL_CRY_PULSES_MS.map((atMs) => ({ atMs, coefficient: 0.4 }))
      },
      {
        type: 'condition',
        ticks: PRIMAL_CRY_PULSES_MS.map((atMs) => ({ atMs, condition: 'Poisoned', stacks: 1, duration: 6 }))
      },
      {
        type: 'condition',
        ticks: PRIMAL_CRY_PULSES_MS.map((atMs) => ({ atMs, condition: 'Bleeding', stacks: 1, duration: 6 }))
      },
      {
        type: 'condition',
        ticks: PRIMAL_CRY_PULSES_MS.map((atMs) => ({ atMs, condition: 'Vulnerability', stacks: 3, duration: 6 }))
      }
    ]),
    castTimeMs: 840
  },
  [ID.WORLDLY_IMPACT]: {
    interruptCommitMs: 520,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 520, coefficient: 1.89 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    castTimeMs: 680
  },
  [ID.PRELUDE_LASH]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.4,
        hits: 1
      },
      {
        type: 'strike',
        coefficient: 0.01,
        hits: 1
      }
    ],
    castTimeMs: 167
  },
  [ID.SPIRITUAL_REPRIEVE]: {
    effects: [
      {
        type: 'boon',
        boon: 'resistance',
        duration: 3,
        stacks: 1
      }
    ],
    castTimeMs: 667
  },
  [ID.UNFLINCHING_FORTITUDE]: {
    effects: [],
    castTimeMs: 167
  }
});
