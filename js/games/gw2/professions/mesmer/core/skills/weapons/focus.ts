import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
/** Canonical Core mesmer skill fragments grouped by their GW2 owner. */
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';

export const MESMER_WEAPONS_FOCUS_SKILL_MECHANICS: Readonly<Record<number, Partial<MesmerSkill>>> = Object.freeze({
  [ID.TEMPORAL_CURTAIN]: {
    // Flip lifetime follows its parent's authored clock, with delayed readiness kept separate.
    flipArm: { skillId: ID.INTO_THE_VOID, duration: 5, delay: 1, anchor: 'castStart' },
    sideEffects: [{ on: 'castCommit', do: { type: 'mesmer.arm-flip' } }],
    castTimeMs: 740,
    effects: []
  },
  [ID.PHANTASMAL_WARDEN]: {
    sideEffects: [{ on: 'castStart', do: { type: 'mesmer.summon-phantasm' } }],
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
        actorType: 'summon',
        summonKind: 'phantasm',
        weapon: 'phantasm medium'
      }
    ],
    castTimeMs: 440
  }
});
