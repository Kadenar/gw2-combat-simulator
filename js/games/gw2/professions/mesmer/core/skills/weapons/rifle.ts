import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
/** Canonical Core mesmer skill fragments grouped by their GW2 owner. */
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';

export const MESMER_WEAPONS_RIFLE_SKILL_MECHANICS: Readonly<Record<number, Partial<MesmerSkill>>> = Object.freeze({
  [ID.FRIENDLY_FIRE]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        name: 'Damage',
        actorType: 'player',
        weapon: 'rifle'
      }
    ]
  },
  [ID.JOURNEY]: {
    castTimeMs: 333.333333333,
    resource: {
      mode: 'add',
      count: 1
    },
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: 'Damage',
        actorType: 'player',
        weapon: 'rifle'
      }
    ]
  },
  [ID.INSPIRING_IMAGERY]: {
    // Flip lifetime follows its parent's authored clock, with delayed readiness kept separate.
    flipArm: { skillId: ID.ABSTRACTION, duration: 2, delay: 0, anchor: 'castCommit' },
    sideEffects: [{ on: 'castCommit', do: { type: 'mesmer.arm-flip' } }],
    castTimeMs: 500,
    // The image grants boons after its field expires unless Abstraction detonates it first.
    comboFields: [{ ownerId: 'mesmer', fieldType: 'Ethereal', duration: 2, startAnchor: 'castEnd' }],
    tasks: [{ type: 'mesmer.core.imagery-expire', atMs: 2000, timingAnchor: 'castEnd' }],
    effects: [
      { type: 'boon', boon: 'might', stacks: 12, duration: 9 },
      { type: 'boon', boon: 'fury', duration: 9 }
    ]
  },
  [ID.PHANTASMAL_SHARPSHOOTER]: {
    sideEffects: [{ on: 'castStart', do: { type: 'mesmer.summon-phantasm' } }],
    // The summon owns its attack and conversion timeline independently of the player cast.
    phantasmTiming: {
      // These lifecycle timings are estimates.
      damageAtMs: 1560,
      spawnAtMs: 1560
    },
    castTimeMs: 500,
    phantasm: true,
    resource: {
      mode: 'phantasm',
      count: 1
    },
    effects: [
      // The phantasm's shot supplies the stun, at its own impact rather than the player's cast completion.
      {
        type: 'control',
        source: 'Phantasm',
        actorType: 'summon',
        summonKind: 'phantasm',
        controlKind: 'stun',
        atMs: 0,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        coefficient: 2.28,
        hits: 1,
        name: 'Phantasm shot',
        actorType: 'summon',
        summonKind: 'phantasm',
        weapon: 'rifle'
      }
    ]
  },
  [ID.SINGULARITY_SHOT]: {
    // Flip lifetime follows its parent's authored clock, with delayed readiness kept separate.
    flipArm: { skillId: ID.DIMENSIONAL_APERTURE, duration: 3, delay: 0, anchor: 'castStart' },
    sideEffects: [{ on: 'castCommit', do: { type: 'mesmer.arm-flip' } }],
    castTimeMs: 333.333333333,
    effects: []
  }
});
