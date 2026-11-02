/** Canonical Core mesmer skill definitions grouped by their GW2 owner. */
import { ACTOR } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

export const MESMER_WEAPONS_FOCUS_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<MesmerSkill>>> = {
  [ID.TEMPORAL_CURTAIN]: {
    name: 'Temporal Curtain',
    icon: 'https://render.guildwars2.com/file/C6352A11D34B060628DE02A6509F6719403E7707/103198.png',
    type: 'Weapon',
    weapon: 'Focus',
    slot: 'Weapon_4',
    cooldown: 25,
    // Flip lifetime follows its parent's authored clock, with delayed readiness kept separate.
    flipArm: { skillId: ID.INTO_THE_VOID, duration: 5, delay: 1, anchor: 'castStart' },
    castTimeMs: 740,
    effects: [],
    sideEffects: [{ on: 'castCommit', do: { type: 'mesmer.arm-flip' } }]
  },
  // Flip actions share their parent's catalog so ordinary mechanics assembly owns both faces.
  [ID.INTO_THE_VOID]: {
    name: 'Into the Void',
    icon: 'https://render.guildwars2.com/file/E4D0E740C1700E3ACFBBD25D7F0C0628E0204559/103758.png',
    type: 'Weapon',
    weapon: 'Focus',
    slot: 'Weapon_4',
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
    name: 'Phantasmal Warden',
    icon: 'https://render.guildwars2.com/file/4E08BB09C3E6BE013AE255D763A3EB7C99AE2644/103768.png',
    type: 'Weapon',
    weapon: 'Focus',
    slot: 'Weapon_5',

    cooldown: 20,
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
};
