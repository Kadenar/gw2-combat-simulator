/** Canonical Core mesmer skill fragments grouped by their GW2 owner. */
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

export const MESMER_WEAPONS_GREATSWORD_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.MIND_STAB]: {
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 200, coefficient: 1.8 }],
        name: 'Damage',
        actorType: 'player',
        weapon: 'greatsword',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    castTimeMs: 320
  },
  [ID.SPATIAL_SURGE]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    interruptMode: 'per-packet',
    castTimeMs: 760,
    effects: [
      {
        type: 'strike',
        // Split the minimum-range coefficient evenly across the three channel hits.
        ticks: [
          { atMs: 360, coefficient: 0.8 / 3 },
          { atMs: 520, coefficient: 0.8 / 3 },
          { atMs: 680, coefficient: 0.8 / 3 }
        ],
        name: 'Minimum-range damage',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.ILLUSIONARY_WAVE]: {
    castTimeMs: 640,
    effects: [
      // Preserve this skill's existing cast-completion CC timing in its own definition.
      {
        type: 'control',
        source: 'Player',
        actorType: 'player',
        atMs: 0,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 400, coefficient: 0.3 }],
        name: 'Damage',
        actorType: 'player',
        weapon: 'greatsword',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.PHANTASMAL_BERSERKER]: {
    // Once committed, interrupting the remaining animation preserves the attack and phantasm summon.
    interruptCommitMs: 520,
    phantasmSummonProgress: 520 / 560,
    phantasm: true,
    resource: {
      mode: 'phantasm',
      count: 1
    },
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 720, coefficient: 0.3 },
          { atMs: 840, coefficient: 0.3 },
          { atMs: 960, coefficient: 0.3 },
          { atMs: 1080, coefficient: 0.3 }
        ],
        name: 'One berserker',
        actorType: 'summon',
        summonKind: 'phantasm',
        weapon: 'phantasm high'
      },
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1,
        name: 'Greatsword damage',
        actorType: 'player',
        weapon: 'greatsword'
      }
    ],
    castTimeMs: 560
  },
  [ID.MIRROR_BLADE]: {
    castTimeMs: 600,
    // The projectile commits before the animation ends; its bounces and clone survive a later interrupt.
    interruptCommitMs: 560,
    resource: {
      mode: 'add',
      count: 1,
      timingAnchor: 'castStart',
      atMs: 560
    },
    blade: true,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 600, coefficient: 2.5 }],
        name: 'Initial target hit',
        persistsAfterInterrupt: true,
        actorType: 'player',
        weapon: 'greatsword',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 760, coefficient: 0.1 }],
        name: 'Second target hit after one ally bounce',
        persistsAfterInterrupt: true,
        actorType: 'player',
        weapon: 'greatsword',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 920, coefficient: 0.004 }],
        name: 'Third target hit after two ally bounces',
        persistsAfterInterrupt: true,
        actorType: 'player',
        weapon: 'greatsword',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        // Four enemy packets form the base skill; Bountiful Blades owns the two additional packets.
        type: 'strike',
        ticks: [{ atMs: 1080, coefficient: 0.00016 }],
        name: 'Fourth target hit after three ally bounces',
        persistsAfterInterrupt: true,
        actorType: 'player',
        weapon: 'greatsword',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  }
});
