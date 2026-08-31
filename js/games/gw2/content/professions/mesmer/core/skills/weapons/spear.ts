/** Canonical Core mesmer skill fragments grouped by their GW2 owner. */
import { MESMER_SKILL_IDS as ID } from '#gw2/content/professions/mesmer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const MESMER_WEAPONS_SPEAR_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.PHANTASMAL_LANCER]: {
    implemented: true,
    type: 'Weapon',
    weapon: 'Spear',
    specialization: '',
    environment: 'Terrestrial',
    quicknessCastTimeMs: 520,
    cooldown: 12,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Mesmer attack',
        actorType: 'player',
        weapon: 'spear'
      },
      {
        type: 'strike',
        coefficient: 0.6,
        hits: 1,
        name: 'One lancer',
        actorType: 'summon',
        summonKind: 'phantasm',
        weapon: 'phantasm medium'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        duration: 3,
        actorType: 'summon',
        summonKind: 'phantasm',
        phantasmEntityIndex: 0
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        duration: 2,
        actorType: 'summon',
        summonKind: 'phantasm',
        phantasmEntityIndex: 1
      }
    ],
    phantasm: true,
    resource: {
      mode: 'phantasm',
      count: 1
    }
  },
  [ID.MENTAL_COLLAPSE]: {
    implemented: true,
    type: 'Weapon',
    weapon: 'Spear',
    specialization: '',
    environment: 'Terrestrial',
    quicknessCastTimeMs: 640,
    cooldown: 20,
    effects: [
      {
        type: 'strike',
        coefficient: 3,
        hits: 3,
        name: 'Damage',
        actorType: 'player',
        weapon: 'spear'
      }
    ]
  },
  [ID.PSYSTRIKE]: {
    implemented: true,
    type: 'Weapon',
    weapon: 'Spear',
    specialization: '',
    environment: 'Terrestrial',
    quicknessCastTimeMs: 520,
    cooldown: 0,
    nextChainId: ID.MIND_PIERCE,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Damage',
        actorType: 'player',
        weapon: 'spear'
      }
    ]
  },
  [ID.MIND_THE_GAP]: {
    implemented: true,
    type: 'Weapon',
    weapon: 'Spear',
    specialization: '',
    environment: 'Terrestrial',
    quicknessCastTimeMs: 600,
    cooldown: 5,
    // Mind the Gap creates its clone with the observed impact packet, before the cast-end cooldown is applied.
    resource: {
      mode: 'add',
      count: 1,
      timingAnchor: 'castStart',
      atMs: 480
    },
    effects: [
      {
        type: 'strike',
        coefficient: 1.92,
        hits: 1,
        name: 'Outer-edge damage',
        actorType: 'player',
        weapon: 'spear'
      }
    ]
  },
  [ID.MIND_PIERCE]: {
    implemented: true,
    type: 'Weapon',
    weapon: 'Spear',
    specialization: '',
    environment: 'Terrestrial',
    quicknessCastTimeMs: 560,
    cooldown: 0,
    nextChainId: null,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: 'Damage',
        actorType: 'player',
        weapon: 'spear'
      }
    ]
  },
  [ID.IMAGINARY_INVERSION]: {
    implemented: true,
    type: 'Weapon',
    weapon: 'Spear',
    specialization: '',
    environment: 'Terrestrial',
    quicknessCastTimeMs: 680,
    interruptCommitMs: 600,
    cooldown: 10,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 600, coefficient: 2.4 }],
        name: 'Damage',
        actorType: 'player',
        weapon: 'spear',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.PSYCUT]: {
    implemented: true,
    type: 'Weapon',
    weapon: 'Spear',
    specialization: '',
    environment: 'Terrestrial',
    cooldown: 0,
    nextChainId: ID.PSYSTRIKE,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Damage',
        actorType: 'player',
        weapon: 'spear'
      }
    ],
    quicknessCastTimeMs: 400
  }
});
