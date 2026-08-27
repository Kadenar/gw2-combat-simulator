/**
 * Raw Troubadour skill mechanics. Generated once from the characterized
 * pre-migration table; this file is now the runtime source owner.
 */
import { MESMER_SKILL_IDS as ID } from '../../data/ids.js';
import type { Skill, SkillFragment, SkillId } from '../../../../../platform/engine/types.js';
import type { MesmerSkill } from '../../types.js';

// Tales share one lifecycle trigger; their specialization resolver owns each Tale's distinct outcome.
const TROUBADOUR_TALE_TRIGGERS = Object.freeze([
  {
    type: 'mesmer.troubadour.resolve-tale',
    timingAnchor: 'castEnd' as const
  }
]);

export const MESMER_TROUBADOUR_SKILL_MECHANICS: Readonly<Record<SkillId, SkillFragment>> = Object.freeze({
  [ID.TROUBADOUR_BLADECALL]: {
    implemented: true,
    type: 'Weapon',
    weapon: 'Dagger',
    specialization: 'Troubadour',
    environment: 'Terrestrial',
    cooldown: 5,
    resource: {
      mode: 'add',
      count: 1
    },
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 199,
            coefficient: 0.25
          },
          {
            atMs: 199,
            coefficient: 0.25
          },
          {
            atMs: 199,
            coefficient: 0.25
          }
        ],
        name: 'Outgoing damage',
        actorType: 'player',
        weapon: 'dagger',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 2716,
            coefficient: 0.25
          },
          {
            atMs: 2716,
            coefficient: 0.25
          },
          {
            atMs: 2766,
            coefficient: 0.25
          }
        ],
        name: 'Returning damage',
        actorType: 'player',
        weapon: 'dagger',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    castTimeMs: 660
  },
  [ID.LIVELY_LUTE]: {
    implemented: true,
    type: 'Profession',
    weapon: '',
    specialization: 'Troubadour',
    environment: 'Terrestrial',
    quicknessCastTimeMs: 560,
    cooldown: 12,
    effects: []
  },
  [ID.TALE_OF_THE_HONORABLE_ROGUE]: {
    implemented: true,
    type: 'Utility',
    weapon: '',
    specialization: 'Troubadour',
    environment: 'Terrestrial',
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    cooldown: 4,
    ammo: 2,
    ammoRecharge: 25,
    ammoCastLockout: 4,
    mechanicTriggers: TROUBADOUR_TALE_TRIGGERS,
    effects: []
  },
  [ID.TALE_OF_THE_SECOND_SCION]: {
    implemented: true,
    type: 'Heal',
    weapon: '',
    specialization: 'Troubadour',
    environment: 'Terrestrial',
    quicknessCastTimeMs: 666.666666667,
    cooldown: 15,
    mechanicTriggers: TROUBADOUR_TALE_TRIGGERS,
    effects: []
  },
  [ID.FLUSTERING_FLUTE]: {
    implemented: true,
    type: 'Profession',
    weapon: '',
    specialization: 'Troubadour',
    environment: 'Terrestrial',
    quicknessCastTimeMs: 560,
    cooldown: 20,
    effects: []
  },
  [ID.TALE_OF_THE_SOULKEEPER]: {
    implemented: true,
    type: 'Utility',
    weapon: '',
    specialization: 'Troubadour',
    environment: 'Terrestrial',
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    cooldown: 20,
    mechanicTriggers: TROUBADOUR_TALE_TRIGGERS,
    effects: []
  },
  [ID.CRESCENDO]: {
    implemented: true,
    type: 'Profession',
    weapon: '',
    specialization: 'Troubadour',
    environment: 'Terrestrial',
    quicknessCastTimeMs: 1000,
    cooldown: 35,
    damageAtMs: 850,
    effects: []
  },
  [ID.HARMONIOUS_HARP]: {
    implemented: true,
    type: 'Profession',
    weapon: '',
    specialization: 'Troubadour',
    environment: 'Terrestrial',
    // Harp's measured two-second Quickness channel derives its three-second base cast.
    quicknessCastTimeMs: 2000,
    paletteInterruptMs: 480,
    cooldown: 25,
    effects: []
  },
  [ID.TALE_OF_THE_AUGUST_QUEEN]: {
    implemented: true,
    type: 'Elite',
    weapon: '',
    specialization: 'Troubadour',
    environment: 'Terrestrial',
    quicknessCastTimeMs: 666.666666667,
    cooldown: 75,
    mechanicTriggers: TROUBADOUR_TALE_TRIGGERS,
    effects: []
  },
  [ID.TALE_OF_THE_TORTURED_MASTERMIND]: {
    implemented: true,
    type: 'Utility',
    weapon: '',
    specialization: 'Troubadour',
    environment: 'Terrestrial',
    quicknessCastTimeMs: 400,
    cooldown: 20,
    mechanicTriggers: TROUBADOUR_TALE_TRIGGERS,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 350, coefficient: 1 },
          { atMs: 1350, coefficient: 1 },
          { atMs: 2350, coefficient: 1 },
          { atMs: 3350, coefficient: 1 }
        ],
        name: 'Damage',
        actorType: 'player',
        weapon: 'utility',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [
          { atMs: 350, condition: 'Torment', duration: 8, stacks: 1 },
          { atMs: 1350, condition: 'Torment', duration: 8, stacks: 1 },
          { atMs: 2350, condition: 'Torment', duration: 8, stacks: 1 },
          { atMs: 3350, condition: 'Torment', duration: 8, stacks: 1 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Weakness',
        duration: 5,
        stacks: 1,
        atMs: 350,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        duration: 4,
        stacks: 10,
        atMs: 1350,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        atMs: 3350,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.HARMONIOUS_HARP_ALTERNATE]: {
    implemented: true,
    type: 'Profession',
    weapon: '',
    specialization: 'Troubadour',
    environment: 'Terrestrial',
    // Keep the duplicate Harp profile aligned with the same interruptible channel contract.
    quicknessCastTimeMs: 2000,
    paletteInterruptMs: 480,
    cooldown: 25,
    effects: []
  },
  [ID.DEAFENING_DRUM]: {
    implemented: true,
    type: 'Profession',
    weapon: '',
    specialization: 'Troubadour',
    environment: 'Terrestrial',
    quicknessCastTimeMs: 680,
    cooldown: 25,
    effects: []
  },
  [ID.TALE_OF_THE_VALIANT_MARSHAL]: {
    implemented: true,
    type: 'Utility',
    weapon: '',
    specialization: 'Troubadour',
    environment: 'Terrestrial',
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    cooldown: 30,
    mechanicTriggers: TROUBADOUR_TALE_TRIGGERS,
    effects: []
  },
  [ID.LIVELY_LUTE_ALTERNATE]: {
    implemented: true,
    type: 'Profession',
    weapon: '',
    specialization: 'Troubadour',
    environment: 'Terrestrial',
    quicknessCastTimeMs: 560,
    cooldown: 12,
    effects: []
  }
});

export const MESMER_TROUBADOUR_SUPPLEMENTAL_SKILL_MECHANICS: Readonly<Record<SkillId, SkillFragment>> = Object.freeze(
  {}
);

export const MESMER_TROUBADOUR_EXTRA_SKILLS: readonly Skill[] = Object.freeze([
  {
    id: ID.DODGE_TROUBADOUR,
    name: 'Dodge',
    description: 'Spend 50 endurance to evade. Mayhem reduces Flustering Flute recharge.',
    icon: 'https://wiki.guildwars2.com/images/b/b2/Dodge.png',
    type: 'Action',
    slot: 'Action',
    specialization: 'Troubadour',
    environment: 'Terrestrial',
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    cooldown: 10,
    ammo: 2,
    implemented: true,
    // Mayhem reacts to the completed dodge rather than a Core Mesmer skill-id branch.
    mechanicTriggers: [
      {
        type: 'mesmer.troubadour.dodge',
        timingAnchor: 'castEnd'
      }
    ],
    effects: []
  }
] satisfies readonly MesmerSkill[]);
