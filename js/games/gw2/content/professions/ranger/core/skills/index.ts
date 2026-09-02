/** Explicit PvE skill mechanics owned by the Core Ranger module. */
import { RANGER_SKILL_IDS as ID } from '#gw2/content/professions/ranger/data/ids.js';
import type { Skill, SkillFragment } from '#gw2/platform/engine/types.js';
import { RANGER_CORE_PET_SKILL_MECHANICS } from '#gw2/content/professions/ranger/core/skills/pet-skills.js';
import { RANGER_CORE_SLOT_SKILL_MECHANICS } from '#gw2/content/professions/ranger/core/skills/slot-skills.js';
import { RANGER_CORE_AXE_SKILL_MECHANICS } from '#gw2/content/professions/ranger/core/skills/weapons/axe.js';
import { RANGER_CORE_DAGGER_SKILL_MECHANICS } from '#gw2/content/professions/ranger/core/skills/weapons/dagger.js';
import { RANGER_CORE_GREATSWORD_SKILL_MECHANICS } from '#gw2/content/professions/ranger/core/skills/weapons/greatsword.js';
import { RANGER_CORE_HAMMER_SKILL_MECHANICS } from '#gw2/content/professions/ranger/core/skills/weapons/hammer.js';
import { RANGER_CORE_LONGBOW_SKILL_MECHANICS } from '#gw2/content/professions/ranger/core/skills/weapons/longbow.js';
import { RANGER_CORE_MACE_SKILL_MECHANICS } from '#gw2/content/professions/ranger/core/skills/weapons/mace.js';
import { RANGER_CORE_SHORTBOW_SKILL_MECHANICS } from '#gw2/content/professions/ranger/core/skills/weapons/shortbow.js';
import { RANGER_CORE_SPEAR_SKILL_MECHANICS } from '#gw2/content/professions/ranger/core/skills/weapons/spear.js';
import { RANGER_CORE_STAFF_SKILL_MECHANICS } from '#gw2/content/professions/ranger/core/skills/weapons/staff.js';
import { RANGER_CORE_SWORD_SKILL_MECHANICS } from '#gw2/content/professions/ranger/core/skills/weapons/sword.js';
import { RANGER_CORE_TORCH_SKILL_MECHANICS } from '#gw2/content/professions/ranger/core/skills/weapons/torch.js';
import { RANGER_CORE_WARHORN_SKILL_MECHANICS } from '#gw2/content/professions/ranger/core/skills/weapons/warhorn.js';

export const RANGER_CORE_BASE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  ...RANGER_CORE_PET_SKILL_MECHANICS,
  ...RANGER_CORE_SLOT_SKILL_MECHANICS,
  ...RANGER_CORE_AXE_SKILL_MECHANICS,
  ...RANGER_CORE_DAGGER_SKILL_MECHANICS,
  ...RANGER_CORE_GREATSWORD_SKILL_MECHANICS,
  ...RANGER_CORE_HAMMER_SKILL_MECHANICS,
  ...RANGER_CORE_LONGBOW_SKILL_MECHANICS,
  ...RANGER_CORE_MACE_SKILL_MECHANICS,
  ...RANGER_CORE_SHORTBOW_SKILL_MECHANICS,
  ...RANGER_CORE_SPEAR_SKILL_MECHANICS,
  ...RANGER_CORE_STAFF_SKILL_MECHANICS,
  ...RANGER_CORE_SWORD_SKILL_MECHANICS,
  ...RANGER_CORE_TORCH_SKILL_MECHANICS,
  ...RANGER_CORE_WARHORN_SKILL_MECHANICS
});

export const RANGER_CORE_EXTRA_SKILLS: readonly Skill[] = Object.freeze([
  // Ranger spear stealth attacks are supplemental catalog identities, so pin
  // their official render icons instead of falling back to the placeholder.
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
  },
  {
    id: ID.PATH_OF_SCARS_MAX_RANGE,
    interruptCommitMs: 360,
    name: 'Path of Scars (Max Range)',
    description: 'Throw your axe from maximum range so its returning strike lands later.',
    icon: 'https://render.guildwars2.com/file/B5B27723701C39327D2145DEE76579FB007F9344/103903.png',
    variantBadge: 'MAX',
    type: 'Weapon',
    weapon: 'Axe',
    slot: 'Weapon_4',
    quicknessCastTimeMs: 440,
    rechargeAnchor: 'castStart',
    cooldown: 15,
    missileHits: 2,
    // Both range variants share the same weapon-slot recharge after completion.
    mechanicTriggers: [
      {
        type: 'ranger.core.sync-path-of-scars-cooldown',
        timingAnchor: 'castEnd'
      }
    ],
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 400, coefficient: 1.2 },
          { atMs: 1640, coefficient: 1.2 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: 'Projectile',
            ambiguousFieldSelection: 'oldest'
          }
        ]
      },
      {
        type: 'control',
        atMs: 1640,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        controlKind: 'pull'
      }
    ]
  },
  {
    id: ID.DODGE,
    name: 'Dodge',
    description: 'Perform a dodge roll.',
    icon: 'https://wiki.guildwars2.com/images/b/b2/Dodge.png',
    type: 'Action',
    weapon: '',
    slot: 'Action',
    castTimeMs: 800,
    unaffectedByQuickness: true,
    rechargeAnchor: 'castStart',
    cooldown: 0,
    // Custom: Spends endurance and applies Ranger dodge traits; see `core/skills/execution.ts`.
    handlerId: 'ranger.dodge',
    effects: []
  },
  {
    id: ID.PET_SWAP,
    name: 'Swap Pets',
    description: 'Swap your active pet and trigger pet-swap traits.',
    icon: 'https://wiki.guildwars2.com/images/c/ce/Weapon_Swap_Button.png',
    type: 'Action',
    weapon: '',
    slot: 'Action',
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    cooldown: 20,
    // Custom: Switches pet slots and applies pet-swap traits; see `core/skills/execution.ts`.
    handlerId: 'ranger.pet-swap',
    effects: []
  },
  {
    id: ID.SWAP_WEAPONS,
    name: 'Swap Weapons',
    description: 'Swap to your alternate weapon set.',
    icon: 'https://wiki.guildwars2.com/images/c/ce/Weapon_Swap_Button.png',
    type: 'Action',
    slot: 'Action',
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    cooldown: 10,
    // Custom: Performs the shared weapon-set transition; see `platform/equipment/weapons/swap.ts`.
    handlerId: 'ranger.weapon-swap',
    effects: []
  }
]);
