/** Canonical Core mesmer skill fragments grouped by their GW2 owner. */
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const MESMER_WEAPONS_SPEAR_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.PHANTASMAL_LANCER]: {
    type: 'Weapon',
    weapon: 'Spear',
    specialization: '',
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
        stacks: 1,
        actorType: 'summon',
        summonKind: 'phantasm',
        phantasmEntityIndex: 0
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        duration: 2,
        stacks: 1,
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
    type: 'Weapon',
    weapon: 'Spear',
    specialization: '',
    quicknessCastTimeMs: 640,
    cooldown: 20,
    effects: [
      {
        type: 'strike',
        coefficient: 3,
        hits: 3,
        atMs: 0,
        name: 'Damage',
        actorType: 'player',
        weapon: 'spear'
      }
    ]
  },
  [ID.PSYSTRIKE]: {
    type: 'Weapon',
    weapon: 'Spear',
    specialization: '',
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
    type: 'Weapon',
    weapon: 'Spear',
    specialization: '',
    quicknessCastTimeMs: 600,
    // Committed interrupts preserve the attack while its full cast still occupies the casting lane.
    interruptCommitMs: 520,
    retainsCastLockoutAfterInterrupt: true,
    cooldown: 5,
    // Keep the observed 485 ms impact after the 480 ms input tick so a just-prior shatter cannot consume this clone.
    resource: {
      mode: 'add',
      count: 1,
      timingAnchor: 'castStart',
      atMs: 485
    },
    effects: [
      {
        type: 'strike',
        coefficient: 1.92,
        hits: 1,
        name: 'Outer-edge damage',
        actorType: 'player',
        weapon: 'spear',
        // The impact lands before the retained aftercast, alongside the clone gain.
        atMs: 485,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.MIND_PIERCE]: {
    type: 'Weapon',
    weapon: 'Spear',
    specialization: '',
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
    type: 'Weapon',
    weapon: 'Spear',
    specialization: '',
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
    type: 'Weapon',
    weapon: 'Spear',
    specialization: '',
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
