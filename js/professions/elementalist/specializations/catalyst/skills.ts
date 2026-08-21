/** Catalyst Elementalist skill mechanics. */
import { CATALYST_JADE_SPHERE_EFFECTS } from './jade-sphere-effects.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '../../data/ids.js';
import type { SkillFragment } from '../../../../platform/engine/types.js';

export const CATALYST_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.DEPLOY_JADE_SPHERE_FIRE]: {
    name: 'Deploy Jade Sphere (Fire)',
    type: 'Profession',
    slot: 'Profession_5',
    specialization: 'Catalyst',
    attunement: 'Fire',
    mechanicSlot: 5,
    categories: ['Jade Sphere'],
    quicknessCastTimeMs: 0,
    cooldown: 15,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: 'Fire',
        duration: 5,
        startAnchor: 'castEnd'
      }
    ],
    skillFamily: 'Jade Sphere',
    implemented: true,
    effects: CATALYST_JADE_SPHERE_EFFECTS[ID.DEPLOY_JADE_SPHERE_FIRE]
  },
  [ID.DEPLOY_JADE_SPHERE_WATER]: {
    name: 'Deploy Jade Sphere (Water)',
    type: 'Profession',
    slot: 'Profession_5',
    specialization: 'Catalyst',
    attunement: 'Water',
    mechanicSlot: 5,
    categories: ['Jade Sphere'],
    quicknessCastTimeMs: 0,
    cooldown: 15,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: 'Water',
        duration: 5,
        startAnchor: 'castEnd'
      }
    ],
    skillFamily: 'Jade Sphere',
    implemented: true,
    effects: CATALYST_JADE_SPHERE_EFFECTS[ID.DEPLOY_JADE_SPHERE_WATER]
  },
  [ID.DEPLOY_JADE_SPHERE_AIR]: {
    name: 'Deploy Jade Sphere (Air)',
    type: 'Profession',
    slot: 'Profession_5',
    specialization: 'Catalyst',
    attunement: 'Air',
    mechanicSlot: 5,
    categories: ['Jade Sphere'],
    quicknessCastTimeMs: 0,
    cooldown: 15,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: 'Lightning',
        duration: 5,
        startAnchor: 'castEnd'
      }
    ],
    skillFamily: 'Jade Sphere',
    implemented: true,
    effects: CATALYST_JADE_SPHERE_EFFECTS[ID.DEPLOY_JADE_SPHERE_AIR]
  },
  [ID.DEPLOY_JADE_SPHERE_EARTH]: {
    name: 'Deploy Jade Sphere (Earth)',
    type: 'Profession',
    slot: 'Profession_5',
    specialization: 'Catalyst',
    attunement: 'Earth',
    mechanicSlot: 5,
    categories: ['Jade Sphere'],
    quicknessCastTimeMs: 0,
    cooldown: 15,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: 'Poison',
        duration: 5,
        startAnchor: 'castEnd'
      }
    ],
    skillFamily: 'Jade Sphere',
    implemented: true,
    effects: CATALYST_JADE_SPHERE_EFFECTS[ID.DEPLOY_JADE_SPHERE_EARTH]
  },
  [ID.RELENTLESS_FIRE]: {
    name: 'Relentless Fire',
    type: 'Utility',
    slot: 'Utility',
    specialization: 'Catalyst',
    categories: ['Augment'],
    quicknessCastTimeMs: 240,
    cooldown: 20,
    skillFamily: 'Augment',
    preservesAutoattackChain: true,
    implemented: true,
    // Relentless Fire opens its damage window when the augment completes.
    mechanicTriggers: [
      {
        type: 'elementalist.catalyst.relentless-fire',
        timingAnchor: 'castEnd'
      }
    ],
    effects: []
  },
  [ID.SHATTERING_ICE]: {
    name: 'Shattering Ice',
    type: 'Utility',
    slot: 'Utility',
    specialization: 'Catalyst',
    categories: ['Augment'],
    quicknessCastTimeMs: 240,
    cooldown: 20,
    skillFamily: 'Augment',
    implemented: true,
    // Shattering Ice opens its proc window when the augment completes.
    mechanicTriggers: [
      {
        type: 'elementalist.catalyst.shattering-ice',
        timingAnchor: 'castEnd'
      }
    ],
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 200,
            coefficient: 0.6
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 200,
            condition: 'Chilled',
            stacks: 1,
            duration: 1
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.ELEMENTAL_CELERITY]: {
    name: 'Elemental Celerity',
    type: 'Elite',
    slot: 'Elite',
    specialization: 'Catalyst',
    categories: ['Augment'],
    quicknessCastTimeMs: 240,
    cooldown: 90,
    skillFamily: 'Augment',
    implemented: true,
    // Elemental Celerity refreshes the active attunement and grants sphere boons on completion.
    mechanicTriggers: [
      {
        type: 'elementalist.catalyst.elemental-celerity',
        timingAnchor: 'castEnd'
      }
    ],
    effects: []
  }
});
