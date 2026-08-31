/** Canonical Core mesmer skill fragments grouped by their GW2 owner. */
import { MESMER_SKILL_IDS as ID } from '#gw2/content/professions/mesmer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const MESMER_WEAPONS_SWORD_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.MIND_SLASH]: {
    implemented: true,
    type: 'Weapon',
    weapon: 'Sword',
    specialization: '',
    environment: 'Terrestrial',
    cooldown: 0,
    nextChainId: ID.MIND_GASH,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Damage',
        actorType: 'player',
        weapon: 'sword'
      }
    ],
    castTimeMs: 540
  },
  [ID.MIND_GASH]: {
    implemented: true,
    type: 'Weapon',
    weapon: 'Sword',
    specialization: '',
    environment: 'Terrestrial',
    castTimeMs: 780,
    cooldown: 0,
    nextChainId: ID.MIND_SPIKE,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Damage',
        actorType: 'player',
        weapon: 'sword'
      }
    ]
  },
  [ID.MIND_SPIKE]: {
    implemented: true,
    type: 'Weapon',
    weapon: 'Sword',
    specialization: '',
    environment: 'Terrestrial',
    castTimeMs: 1260,
    cooldown: 0,
    boonlessCoefficient: 2,
    nextChainId: null,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: 'Damage',
        actorType: 'player',
        weapon: 'sword'
      }
    ]
  },
  [ID.ILLUSIONARY_LEAP]: {
    implemented: true,
    type: 'Weapon',
    weapon: 'Sword',
    specialization: '',
    environment: 'Terrestrial',
    castTimeMs: 600,
    cooldown: 12,
    resource: {
      mode: 'add',
      count: 1
    },
    effects: [
      {
        type: 'strike',
        coefficient: 0.003,
        hits: 1,
        name: 'Damage',
        actorType: 'player',
        weapon: 'sword'
      }
    ]
  },
  [ID.PHANTASMAL_SWORDSMAN]: {
    implemented: true,
    type: 'Weapon',
    weapon: 'Sword',
    specialization: '',
    environment: 'Terrestrial',
    cooldown: 15,
    phantasm: true,
    resource: {
      mode: 'phantasm',
      count: 1
    },
    // The phantasm is committed 720 ms into its measured 880 ms Quickness cast.
    phantasmSummonProgress: 720 / 880,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        name: 'Mesmer strike',
        actorType: 'player',
        weapon: 'sword',
        castProgress: 0.8625
      },
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        atMs: 845,
        name: 'Phantasm leap',
        actorType: 'summon',
        summonKind: 'phantasm',
        weapon: 'phantasm medium'
      },
      {
        type: 'strike',
        ticks: [
          { atMs: 1321, coefficient: 0.2 },
          { atMs: 1362, coefficient: 0.2 },
          { atMs: 1645, coefficient: 0.2 },
          { atMs: 1679, coefficient: 0.2 },
          { atMs: 1920, coefficient: 0.2 },
          { atMs: 1962, coefficient: 0.2 },
          { atMs: 2246, coefficient: 0.2 },
          { atMs: 2279, coefficient: 0.2 }
        ],
        name: 'Phantasm Blurred Frenzy',
        actorType: 'summon',
        summonKind: 'phantasm',
        weapon: 'phantasm medium'
      }
    ],
    castTimeMs: 1320
  },
  [ID.ILLUSIONARY_RIPOSTE]: {
    implemented: true,
    type: 'Weapon',
    weapon: 'Sword',
    specialization: '',
    environment: 'Terrestrial',
    quicknessCastTimeMs: 1500,
    cooldown: 12,
    resource: {
      mode: 'add',
      count: 1
    },
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Damage',
        actorType: 'player',
        weapon: 'sword'
      }
    ],
    defaultInterruptMs: 120,
    interruptCommitMs: 100
  },
  [ID.BLURRED_FRENZY]: {
    implemented: true,
    interruptMode: 'per-packet',
    type: 'Weapon',
    weapon: 'Sword',
    specialization: '',
    environment: 'Terrestrial',
    castTimeMs: 1440,
    cooldown: 10,
    effects: [
      {
        type: 'strike',
        coefficient: 3.6,
        hits: 8,
        atMs: 0,
        name: 'Damage',
        actorType: 'player',
        weapon: 'sword'
      }
    ]
  },
  [ID.BLADE_LEAP]: {
    implemented: true,
    type: 'Weapon',
    weapon: 'Sword',
    specialization: 'Troubadour',
    environment: 'Terrestrial',
    quicknessCastTimeMs: 500,
    cooldown: 12,
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
        weapon: 'sword'
      }
    ]
  }
});
