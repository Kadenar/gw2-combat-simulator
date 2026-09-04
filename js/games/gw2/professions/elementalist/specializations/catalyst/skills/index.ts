/**
 * Owns Catalyst Jade Sphere and augment skill catalog fragments only.
 * Energy, sphere, and empowerment state lives under `mechanics/`.
 */
import { CATALYST_JADE_SPHERE_EFFECTS } from '#gw2/professions/elementalist/specializations/catalyst/mechanics/jade-sphere-effects.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

/**
 * Catalyst skill fragments: the four attunement-gated Deploy Jade Sphere profession
 * skills, each placing a five-second combo field of its element, and the three
 * augments whose `mechanicTriggers` fire their Catalyst handler at cast end.
 */
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
    // Shattering Ice opens its proc window when the augment completes.
    mechanicTriggers: [
      {
        type: 'elementalist.catalyst.shattering-ice',
        timingAnchor: 'castEnd'
      }
    ],
    // The activation only opens a proc window; successful attacks own every strike and chill packet.
    effects: []
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
