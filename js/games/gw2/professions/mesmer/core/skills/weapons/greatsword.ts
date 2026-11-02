import { ACTOR, WEAPON } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { bountifulBladesMirrorBlade } from '#gw2/professions/mesmer/core/traits/domination/index.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

export const MESMER_WEAPONS_GREATSWORD_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<MesmerSkill>>> = {
  [ID.SPATIAL_SURGE]: {
    name: 'Spatial Surge',
    icon: 'https://render.guildwars2.com/file/0F9E5C7DD5545290E3D41B5603FC0327EB9E6725/103615.png',
    type: 'Weapon',
    weapon: 'Greatsword',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 760,
    interruptMode: 'per-packet',
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
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.MIRROR_BLADE]: {
    name: 'Mirror Blade',
    icon: 'https://render.guildwars2.com/file/2E3FFCF506520375FEA923CAC4B25846035B5A0D/103789.png',
    type: 'Weapon',
    weapon: 'Greatsword',
    slot: 'Weapon_2',
    cooldown: 5,
    resource: {
      mode: 'add',
      count: 1,
      timingAnchor: 'castStart',
      atMs: 560
    },
    blade: true,
    castTimeMs: 600,
    // The projectile commits before the animation ends; its bounces and clone survive a later interrupt.
    interruptCommitMs: 560,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 600, coefficient: 2.5 }],
        name: 'Initial target hit',
        persistsAfterInterrupt: true,
        actorType: ACTOR.PLAYER,
        weapon: WEAPON.GREATSWORD.toLowerCase(),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 760, coefficient: 0.1 }],
        name: 'Second target hit after one ally bounce',
        persistsAfterInterrupt: true,
        actorType: ACTOR.PLAYER,
        weapon: WEAPON.GREATSWORD.toLowerCase(),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 920, coefficient: 0.004 }],
        name: 'Third target hit after two ally bounces',
        persistsAfterInterrupt: true,
        actorType: ACTOR.PLAYER,
        weapon: WEAPON.GREATSWORD.toLowerCase(),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        // Four enemy packets form the base skill; Bountiful Blades owns the two additional packets.
        type: 'strike',
        ticks: [{ atMs: 1080, coefficient: 0.00016 }],
        name: 'Fourth target hit after three ally bounces',
        persistsAfterInterrupt: true,
        actorType: ACTOR.PLAYER,
        weapon: WEAPON.GREATSWORD.toLowerCase(),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    // Trait bounces share the base projectile's commitment, targeting, and impact delay.
    effectVariants: [bountifulBladesMirrorBlade]
  },
  [ID.MIND_STAB]: {
    name: 'Mind Stab',
    icon: 'https://render.guildwars2.com/file/DA0126D7F32A973F4432E2070C0DB7252F561E90/103584.png',
    type: 'Weapon',
    weapon: 'Greatsword',
    slot: 'Weapon_3',
    cooldown: 10,
    // Mind Stab gains its own vulnerability bonus in addition to ordinary target vulnerability.
    modifiers: [
      {
        id: 'mesmer.mind-stab-vulnerability',
        label: 'Mind Stab - vulnerability',
        target: 'strikeDamage',
        operation: 'multiply',
        parameters: { baseFactor: 1, damagePerStack: 0.01 },
        factor: (context, _target, parameters) =>
          parameters.baseFactor +
          (context.query?.vulnerabilityStacksAt(context.time, context.runtime) || 0) * parameters.damagePerStack,
        order: 94
      }
    ],
    castTimeMs: 320,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 200, coefficient: 1.8 }],
        name: 'Damage',
        actorType: ACTOR.PLAYER,
        weapon: WEAPON.GREATSWORD.toLowerCase(),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.PHANTASMAL_BERSERKER]: {
    name: 'Phantasmal Berserker',
    icon: 'https://render.guildwars2.com/file/3EE57D40E5F2B376FF921FA7455D00319C7DB8A8/103747.png',
    type: 'Weapon',
    weapon: 'Greatsword',
    slot: 'Weapon_4',

    cooldown: 12,
    // The summon owns its attack and conversion timeline independently of the player cast.
    phantasmTiming: {
      damageAtMs: 1360,
      damageAtMsByEntity: [1080, 1360],
      spawnAtMs: 2620,
      spawnAtMsByEntity: [2360, 2620],
      damageTicksByEntity: [
        {
          'One berserker': [{ atMs: 720 }, { atMs: 840 }, { atMs: 960 }, { atMs: 1080 }]
        },
        {
          'One berserker': [{ atMs: 1000 }, { atMs: 1120 }, { atMs: 1240 }, { atMs: 1360 }]
        }
      ]
    },
    phantasmSummonProgress: 520 / 560,
    phantasm: true,
    resource: {
      mode: 'phantasm',
      count: 1
    },
    castTimeMs: 560,
    // Once committed, interrupting the remaining animation preserves the attack and phantasm summon.
    interruptCommitMs: 520,
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
        actorType: ACTOR.SUMMON,
        summonKind: 'phantasm',
        weapon: 'phantasm high'
      },
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1,
        name: 'Greatsword damage',
        actorType: ACTOR.PLAYER,
        weapon: WEAPON.GREATSWORD.toLowerCase()
      }
    ],
    sideEffects: [{ on: 'castStart', do: { type: 'mesmer.summon-phantasm' } }]
  },
  [ID.ILLUSIONARY_WAVE]: {
    name: 'Illusionary Wave',
    icon: 'https://render.guildwars2.com/file/5C16C0DE262ECCA295D80DA692EBC23A795DB9F7/103585.png',
    type: 'Weapon',
    weapon: 'Greatsword',
    slot: 'Weapon_5',
    cooldown: 20,
    castTimeMs: 640,
    effects: [
      // Preserve this skill's existing cast-completion CC timing in its own definition.
      {
        type: 'control',
        source: 'Player',
        actorType: ACTOR.PLAYER,
        atMs: 0,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 400, coefficient: 0.3 }],
        name: 'Damage',
        actorType: ACTOR.PLAYER,
        weapon: WEAPON.GREATSWORD.toLowerCase(),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  }
};
