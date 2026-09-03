/** Canonical Core ranger skill fragments grouped by their GW2 owner. */
import { RANGER_SKILL_IDS as ID } from '#gw2/content/professions/ranger/data/ids.js';
import type { Skill, SkillFragment } from '#gw2/platform/engine/types.js';

export const RANGER_CORE_SPEAR_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.DRAKES_SWIPE]: {
    effects: [
      {
        type: 'strike',
        coefficient: 1.1,
        hits: 1
      }
    ],
    quicknessCastTimeMs: 333
  },
  [ID.FALCONS_STOOP]: {
    effects: [
      {
        type: 'strike',
        coefficient: 1.95,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 4
      }
    ],
    quicknessCastTimeMs: 500
  },
  [ID.PANTHERS_PROWL]: {
    effects: [
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 6,
        stacks: 1
      }
    ],
    quicknessCastTimeMs: 333
  },
  [ID.WARCLAWS_ENGAGE]: {
    evades: true,
    effects: [
      {
        type: 'strike',
        coefficient: 2.75,
        hits: 1
      }
    ],
    quicknessCastTimeMs: 500
  },
  [ID.CHEETAHS_STRIKE]: {
    effects: [
      {
        type: 'strike',
        coefficient: 1.8,
        hits: 1
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 3,
        stacks: 1
      }
    ],
    quicknessCastTimeMs: 500
  },
  [ID.MONGOOSES_FRENZY]: {
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 2,
        atMs: 0
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 8,
        duration: 8
      }
    ],
    quicknessCastTimeMs: 667
  },
  [ID.WYVERNS_LASH]: {
    effects: [
      {
        type: 'strike',
        coefficient: 1.4,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 2
      }
    ],
    quicknessCastTimeMs: 333
  }
});

/** Owns supplemental Ranger spear stealth-attack identities omitted by the API catalog. */
export const RANGER_CORE_SPEAR_EXTRA_SKILLS: readonly Skill[] = Object.freeze([
  {
    id: ID.WOLFS_ONSLAUGHT,
    name: "Wolf's Onslaught",
    description: 'Stealth Attack. Slash enemies in front of you, then follow up with a powerful blow.',
    icon: 'https://render.guildwars2.com/file/E1550C4BB87B62B14AC39E3F2DB2AC4E07F55F91/3379175.png',
    type: 'Weapon',
    weapon: 'Spear',
    slot: 'Weapon_2',
    quicknessCastTimeMs: 667,
    recharge: 5,
    cooldown: 5,
    flipParentId: ID.MONGOOSES_FRENZY,
    stealthAttack: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 222, coefficient: 1.25 },
          { atMs: 444.666667, coefficient: 1.25 },
          { atMs: 666.666667, coefficient: 2.5 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 3,
        duration: 8
      }
    ]
  },
  {
    id: ID.OWLS_FLIGHT,
    name: "Owl's Flight",
    description: 'Stealth Attack. Reveal yourself and throw an unblockable, piercing spear.',
    icon: 'https://render.guildwars2.com/file/FBA45321DB6E98FB510AF8215EF0A19EB4FB4FC6/3379177.png',
    type: 'Weapon',
    weapon: 'Spear',
    slot: 'Weapon_3',
    quicknessCastTimeMs: 500,
    recharge: 7,
    cooldown: 7,
    flipParentId: ID.FALCONS_STOOP,
    stealthAttack: true,
    effects: [
      {
        type: 'strike',
        coefficient: 3.25,
        hits: 1,
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: 'Projectile',
            ambiguousFieldSelection: 'oldest'
          }
        ]
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 4
      }
    ]
  },
  {
    id: ID.PREDATORS_AMBUSH,
    name: "Predator's Ambush",
    description:
      'Stealth Attack. Leap to a target location, dazing enemies. Deal increased damage to foes below the health threshold.',
    icon: 'https://render.guildwars2.com/file/2D36D9D30E372A750D700F3334A8CE697B4C3010/3379179.png',
    type: 'Weapon',
    weapon: 'Spear',
    slot: 'Weapon_4',
    quicknessCastTimeMs: 760,
    recharge: 12,
    cooldown: 12,
    flipParentId: ID.WARCLAWS_ENGAGE,
    stealthAttack: true,
    evades: true,
    effects: [
      {
        type: 'strike',
        coefficient: 3.67,
        hits: 1,
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: 'Leap',
            ambiguousFieldSelection: 'oldest'
          }
        ]
      },
      {
        type: 'control',
        controlKind: 'daze'
      }
    ]
  },
  {
    id: ID.SPIDERS_WEB,
    name: "Spider's Web",
    description: 'Stealth Attack. Throw a net that damages, immobilizes, and cripples enemies.',
    icon: 'https://render.guildwars2.com/file/1C6D1E0860B3B6C24136F1489F5AACD87D329EC7/3379181.png',
    type: 'Weapon',
    weapon: 'Spear',
    slot: 'Weapon_5',
    quicknessCastTimeMs: 333,
    recharge: 20,
    cooldown: 20,
    flipParentId: ID.PANTHERS_PROWL,
    stealthAttack: true,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 2
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 4
      }
    ]
  }
]);
