/** Canonical Core mesmer skill fragments grouped by their GW2 owner. */
import { MESMER_SKILL_IDS as ID } from '#gw2/content/professions/mesmer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const MESMER_WEAPONS_STAFF_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.CHAOS_STORM]: {
    implemented: true,
    type: 'Weapon',
    weapon: 'Staff',
    specialization: '',
    environment: 'Terrestrial',
    cooldown: 20,
    comboFields: [
      {
        ownerId: 'mesmer',
        fieldType: 'Ethereal',
        duration: 5,
        startAnchor: 'castEnd'
      }
    ],
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 281, coefficient: 0.33 },
          { atMs: 1279, coefficient: 0.33 },
          { atMs: 2280, coefficient: 0.33 },
          { atMs: 3282, coefficient: 0.33 },
          { atMs: 4279, coefficient: 0.33 },
          { atMs: 5280, coefficient: 0.33 }
        ],
        name: 'Six pulses',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        duration: 4,
        stacks: 2
      }
    ],
    quicknessCastTimeMs: 480
  },
  [ID.PHANTASMAL_WARLOCK]: {
    implemented: true,
    type: 'Weapon',
    weapon: 'Staff',
    specialization: '',
    environment: 'Terrestrial',
    cooldown: 12,
    phantasm: true,
    resource: {
      mode: 'phantasm',
      count: 2
    },
    phantasmSummonProgress: 0.7619047619047619,
    effects: [
      {
        type: 'strike',
        coefficient: 0.45,
        hits: 3,
        name: 'One warlock',
        actorType: 'summon',
        summonKind: 'phantasm',
        weapon: 'Phantasm high'
      },
      {
        type: 'condition',
        condition: 'Torment',
        duration: 4,
        stacks: 6,
        actorType: 'summon',
        summonKind: 'phantasm'
      }
    ],
    quicknessCastTimeMs: 840
  },
  [ID.WINDS_OF_CHAOS]: {
    implemented: true,
    type: 'Weapon',
    weapon: 'Staff',
    specialization: '',
    environment: 'Terrestrial',
    cooldown: 0,
    interruptCommitMs: 560,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 533, coefficient: 0.3 },
          { atMs: 623, coefficient: 0.3 }
        ],
        name: 'Damage',
        actorType: 'player',
        weapon: 'staff',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: 'torment',
        duration: 5,
        stacks: 1,
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: 'confusion',
        duration: 5,
        stacks: 1,
        persistsAfterInterrupt: true
      }
    ],
    quicknessCastTimeMs: 760
  },
  [ID.PHASE_RETREAT]: {
    implemented: true,
    type: 'Weapon',
    weapon: 'Staff',
    specialization: '',
    environment: 'Terrestrial',
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    cooldown: 8,
    resource: {
      mode: 'add',
      count: 1
    },
    effects: []
  },
  [ID.CHAOS_ARMOR]: {
    implemented: true,
    type: 'Weapon',
    weapon: 'Staff',
    specialization: '',
    environment: 'Terrestrial',
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    cooldown: 16,
    effects: [
      {
        type: 'condition',
        condition: 'confusion',
        duration: 5,
        stacks: 3
      }
    ]
  }
});
