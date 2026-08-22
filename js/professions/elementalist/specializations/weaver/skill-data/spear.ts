/** Spear weapon-skill mechanics owned by the Weaver module. */

import { ELEMENTALIST_SKILL_IDS as ID } from '../../../data/ids.js';
import type { SkillFragment } from '../../../../../platform/engine/types.js';

export const WEAVER_SPEAR_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.FROSTFIRE_WARD]: {
    name: 'Frostfire Ward',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Spear',
    attunement: 'Fire+Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 0,
    cooldown: 15,
    aura: 'Fire|3',
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 0,
            coefficient: 1
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    specialization: 'Weaver'
  },
  [ID.GALVANIZE]: {
    name: 'Galvanize',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Spear',
    attunement: 'Fire+Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 0,
    cooldown: 12,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 0,
            coefficient: 2.6
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'boon',
        boon: 'Superspeed',
        stacks: 1,
        duration: 3,
        durationScale: 'boon',
        atMs: 0,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'boon',
        boon: 'Might',
        stacks: 3,
        duration: 6,
        durationScale: 'boon',
        atMs: 0,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ],
    specialization: 'Weaver'
  },
  [ID.FIERY_IMPACT]: {
    name: 'Fiery Impact',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Spear',
    attunement: 'Fire+Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 0,
    cooldown: 15,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 0,
            coefficient: 1.75,
            comboFinishers: [
              {
                ownerId: 'elementalist',
                finisherType: 'Blast',
                ambiguousFieldSelection: 'oldest'
              }
            ],
            metadata: {}
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 0,
            condition: 'Burning',
            stacks: 1,
            duration: 5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 0,
            condition: 'Bleeding',
            stacks: 3,
            duration: 6
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ],
    specialization: 'Weaver'
  },
  [ID.ELUTRIATE]: {
    name: 'Elutriate',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Spear',
    attunement: 'Air+Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 0,
    cooldown: 20,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 0,
            coefficient: 1.25
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 0,
            condition: 'Vulnerability',
            stacks: 5,
            duration: 8
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 0,
            condition: 'Chilled',
            stacks: 1,
            duration: 4
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ],
    specialization: 'Weaver'
  },
  [ID.SOOTHING_BURST]: {
    name: 'Soothing Burst',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Spear',
    attunement: 'Water+Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 0,
    cooldown: 20,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 0,
            coefficient: 1,
            comboFinishers: [
              {
                ownerId: 'elementalist',
                finisherType: 'Blast',
                ambiguousFieldSelection: 'oldest'
              }
            ],
            metadata: {}
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    specialization: 'Weaver'
  },
  [ID.SHALE_STORM]: {
    name: 'Shale Storm',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Spear',
    attunement: 'Air+Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 0,
    cooldown: 18,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 0,
            coefficient: 1.55
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'blind',
        atMs: 0,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {
          controlKind: 'blind'
        }
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 0,
            condition: 'Cripple',
            stacks: 1,
            duration: 5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ],
    specialization: 'Weaver'
  }
});
