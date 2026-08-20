/**
 * Raw Mirage skill mechanics. Generated once from the characterized
 * pre-migration table; this file is now the runtime source owner.
 */
import { MESMER_SKILL_IDS as ID } from '../../data/ids.js';
import type { Skill, SkillFragment, SkillId } from '../../../../platform/engine/types.js';
import type { MesmerSkill } from '../../types.js';

export const MESMER_MIRAGE_SKILL_MECHANICS: Readonly<Record<SkillId, SkillFragment>> = Object.freeze({
  [ID.FALSE_OASIS]: {
    implemented: true,
    type: 'Heal',
    weapon: '',
    specialization: 'Mirage',
    environment: 'Terrestrial',
    castTimeMs: 1440,
    cooldown: 25,
    phantasm: false,
    resource: null,
    blade: false,
    // False Oasis leaves its mirror three seconds after the cast finishes.
    mechanicTriggers: [
      {
        type: 'mesmer.mirage.create-mirror',
        count: 1,
        atMs: 3000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    effects: []
  },
  [ID.CRYSTAL_SANDS]: {
    implemented: true,
    type: 'Utility',
    weapon: '',
    specialization: 'Mirage',
    environment: 'Terrestrial',
    quicknessCastTimeMs: 371,
    cooldown: 20,
    phantasm: false,
    resource: null,
    blade: false,
    mechanicTriggers: [
      {
        type: 'mesmer.mirage.create-mirror',
        count: 1,
        atMs: 320,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 2.4,
        hits: 6,
        atMs: 320,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        name: 'Damage',
        actorType: 'player',
        weapon: 'utility'
      },
      {
        type: 'condition',
        condition: 'confusion',
        duration: 4,
        stacks: 6,
        atMs: 320,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.MIRAGE_ADVANCE]: {
    implemented: true,
    type: 'Utility',
    weapon: '',
    specialization: 'Mirage',
    environment: 'Terrestrial',
    quicknessCastTimeMs: 500,
    cooldown: 25,
    phantasm: false,
    resource: null,
    blade: false,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: 'Damage',
        actorType: 'player',
        weapon: 'utility'
      }
    ]
  },
  [ID.SAND_THROUGH_GLASS]: {
    implemented: true,
    type: 'Utility',
    weapon: '',
    specialization: 'Mirage',
    environment: 'Terrestrial',
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    cooldown: 20,
    phantasm: false,
    resource: null,
    blade: false,
    // These instant Deceptions grant Mirage Cloak when their cast completes.
    mechanicTriggers: [
      {
        type: 'mesmer.mirage.grant-cloak',
        timingAnchor: 'castEnd'
      }
    ],
    effects: []
  },
  [ID.ILLUSIONARY_AMBUSH]: {
    implemented: true,
    type: 'Utility',
    weapon: '',
    specialization: 'Mirage',
    environment: 'Terrestrial',
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    cooldown: 20,
    phantasm: false,
    resource: null,
    blade: false,
    mechanicTriggers: [
      {
        type: 'mesmer.mirage.grant-cloak',
        timingAnchor: 'castEnd'
      }
    ],
    effects: []
  },
  [ID.JAUNT]: {
    implemented: true,
    type: 'Elite',
    weapon: '',
    specialization: 'Mirage',
    environment: 'Terrestrial',
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    cooldown: 0.5,
    phantasm: false,
    resource: null,
    blade: false,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Damage',
        actorType: 'player',
        weapon: 'utility'
      },
      {
        type: 'condition',
        condition: 'confusion',
        duration: 6,
        stacks: 3
      }
    ]
  }
});

export const MESMER_MIRAGE_SUPPLEMENTAL_SKILL_MECHANICS: Readonly<Record<SkillId, SkillFragment>> = Object.freeze({
  [ID.CHAOS_VORTEX]: {
    quicknessCastTimeMs: 720,
    cooldown: 1,
    phantasm: false,
    resource: null,
    blade: false,
    ambush: true,
    implemented: true,
    effects: []
  },
  [ID.ETHER_BARRAGE]: {
    castTimeMs: 1500,
    cooldown: 1,
    phantasm: false,
    resource: null,
    blade: false,
    ambush: true,
    implemented: true,
    effects: []
  },
  [ID.SPLIT_SURGE]: {
    quicknessCastTimeMs: 940,
    cooldown: 0.5,
    phantasm: false,
    resource: null,
    blade: false,
    ambush: true,
    implemented: true,
    effects: []
  },
  [ID.IMAGINARY_AXES]: {
    quicknessCastTimeMs: 440,
    cooldown: 1,
    phantasm: false,
    resource: null,
    blade: false,
    ambush: true,
    implemented: true,
    effects: []
  },
  [ID.MIRAGE_THRUST]: {
    quicknessCastTimeMs: 500,
    cooldown: 1,
    phantasm: false,
    resource: null,
    blade: false,
    ambush: true,
    implemented: true,
    effects: []
  },
  [ID.PHANTOM_RAZOR]: {
    quicknessCastTimeMs: 600,
    cooldown: 1,
    phantasm: false,
    resource: null,
    blade: false,
    ambush: true,
    implemented: true,
    effects: []
  },
  [ID.EFFERVESCENCE]: {
    quicknessCastTimeMs: 166.666666667,
    cooldown: 1,
    phantasm: false,
    resource: null,
    blade: false,
    ambush: true,
    implemented: true,
    effects: []
  },
  [ID.FRACTURED_GLASS]: {
    quicknessCastTimeMs: 880,
    cooldown: 1,
    phantasm: false,
    resource: null,
    blade: false,
    ambush: true,
    implemented: true,
    effects: []
  }
});

export const MESMER_MIRAGE_EXTRA_SKILLS: readonly Skill[] = Object.freeze([
  {
    id: ID.DODGE_MIRAGE_CLOAK,
    name: 'Dodge / Mirage Cloak',
    description:
      'Spend 50 endurance. Mirage gains Mirage Cloak and an ambush window; Infinite Horizon commands active clones to ambush.',
    icon: 'https://wiki.guildwars2.com/images/b/b2/Dodge.png',
    type: 'Action',
    slot: 'Action',
    specialization: 'Mirage',
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    cooldown: 10,
    ammo: 2,
    implemented: true,
    effects: []
  },
  {
    id: ID.PICK_UP_MIRAGE_MIRROR,
    name: 'Pick Up Mirage Mirror',
    description: 'Pick up an available Mirage Mirror, damaging nearby enemies and gaining Mirage Cloak.',
    icon: 'https://render.guildwars2.com/file/7F3FA1CD20D930E7EEC75459E7206979DD0AD016/1770518.png',
    type: 'Action',
    slot: 'Action',
    specialization: 'Mirage',
    castTimeMs: 0,
    cooldown: 0,
    implemented: true,
    effects: []
  }
] satisfies readonly MesmerSkill[]);
