import { ACTOR } from '#gw2/platform/constants.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
/** Canonical Core mesmer skill fragments grouped by their GW2 owner. */
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';

export const MESMER_WEAPONS_FOCUS_SKILL_MECHANICS: Readonly<Record<number, Partial<MesmerSkill>>> = Object.freeze({
  [ID.TEMPORAL_CURTAIN]: {
    // Flip lifetime follows its parent's authored clock, with delayed readiness kept separate.
    flipArm: { skillId: ID.INTO_THE_VOID, duration: 5, delay: 1, anchor: 'castStart' },
    castTimeMs: 740,
    effects: [],
    sideEffects: [{ on: 'castCommit', do: { type: 'mesmer.arm-flip' } }]
  },
  // Flip actions share their parent's catalog so ordinary mechanics assembly owns both faces.
  [ID.INTO_THE_VOID]: {
    rechargeAnchor: 'castStart',
    cooldown: 0,
    castTimeMs: 0,
    // Activating the flip applies its pull immediately.
    effects: [
      {
        type: 'control',
        source: 'Player',
        actorType: ACTOR.PLAYER,
        atMs: 0,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.INTO_THE_VOID } }]
  },
  [ID.PHANTASMAL_WARDEN]: {
    // The summon owns its attack and conversion timeline independently of the player cast.
    phantasmTiming: {
      damageAtMs: 4880,
      spawnAtMs: 7040
    },
    phantasm: true,
    resource: {
      mode: 'phantasm',
      count: 1
    },
    castTimeMs: 440,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 880, coefficient: 0.138 },
          { atMs: 1240, coefficient: 0.138 },
          { atMs: 1600, coefficient: 0.138 },
          { atMs: 1960, coefficient: 0.138 },
          { atMs: 2320, coefficient: 0.138 },
          { atMs: 2680, coefficient: 0.138 },
          { atMs: 3080, coefficient: 0.138 },
          { atMs: 3440, coefficient: 0.138 },
          { atMs: 3800, coefficient: 0.138 },
          { atMs: 4160, coefficient: 0.138 },
          { atMs: 4520, coefficient: 0.138 },
          { atMs: 4880, coefficient: 0.138 }
        ],
        name: 'Damage',
        actorType: ACTOR.SUMMON,
        summonKind: 'phantasm',
        weapon: 'phantasm medium'
      }
    ],
    sideEffects: [{ on: 'castStart', do: { type: 'mesmer.summon-phantasm' } }]
  }
});
