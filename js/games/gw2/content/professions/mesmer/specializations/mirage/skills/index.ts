/**
 * Raw Mirage skill mechanics. Generated once from the characterized
 * pre-migration table; this file is now the runtime source owner.
 */
import { MESMER_SKILL_IDS as ID } from '#gw2/content/professions/mesmer/data/ids.js';
import type { Skill, SkillFragment, SkillId } from '#gw2/platform/engine/types.js';
import type { MesmerSkill } from '#gw2/content/professions/mesmer/types.js';

export const MESMER_MIRAGE_SKILL_MECHANICS: Readonly<Record<SkillId, SkillFragment>> = Object.freeze({
  [ID.FALSE_OASIS]: {
    implemented: true,
    type: 'Heal',
    weapon: '',
    specialization: 'Mirage',
    environment: 'Terrestrial',
    castTimeMs: 1440,
    cooldown: 25,
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
        ticks: Array.from({ length: 6 }, (_, index) => ({ atMs: 320, coefficient: 2.4 / 6 })),
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        name: 'Damage',
        actorType: 'player',
        weapon: 'utility'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 320, condition: 'confusion', stacks: 6, duration: 4 }],
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
    ambush: true,
    implemented: true,
    effects: []
  },
  [ID.ETHER_BARRAGE]: {
    castTimeMs: 1500,
    cooldown: 1,
    ambush: true,
    implemented: true,
    effects: []
  },
  [ID.SPLIT_SURGE]: {
    quicknessCastTimeMs: 960,
    cooldown: 0.5,
    ambush: true,
    implemented: true,
    effects: []
  },
  [ID.IMAGINARY_AXES]: {
    quicknessCastTimeMs: 440,
    cooldown: 1,
    ambush: true,
    implemented: true,
    effects: []
  },
  [ID.MIRAGE_THRUST]: {
    quicknessCastTimeMs: 500,
    cooldown: 1,
    ambush: true,
    implemented: true,
    effects: []
  },
  [ID.PHANTOM_RAZOR]: {
    quicknessCastTimeMs: 600,
    cooldown: 1,
    ambush: true,
    implemented: true,
    effects: []
  },
  [ID.EFFERVESCENCE]: {
    quicknessCastTimeMs: 166.666666667,
    cooldown: 1,
    ambush: true,
    implemented: true,
    effects: []
  },
  [ID.FRACTURED_GLASS]: {
    quicknessCastTimeMs: 880,
    cooldown: 1,
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
    // Mirage dodge grants cloak and resolves dodge-triggered Mirage traits at completion.
    mechanicTriggers: [
      {
        type: 'mesmer.mirage.dodge',
        timingAnchor: 'castEnd'
      }
    ],
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
    // Picking up the action consumes the available ground mirror at cast completion.
    mechanicTriggers: [
      {
        type: 'mesmer.mirage.pick-up-mirror',
        timingAnchor: 'castEnd'
      }
    ],
    effects: []
  }
] satisfies readonly MesmerSkill[]);
