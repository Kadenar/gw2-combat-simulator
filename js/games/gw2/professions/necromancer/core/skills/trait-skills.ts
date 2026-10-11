import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';
/** Invoked skills own their patchable payloads and recharge; traits own trigger eligibility. */
export const NECROMANCER_CORE_TRAIT_SKILLS: readonly Skill[] = Object.freeze([
  {
    id: ID.LESSER_CHILBLAINS,
    name: 'Lesser Chilblains',
    type: 'Proc',
    slot: 'Action',
    simulatorExcluded: true,
    slotSelectable: false,
    castTimeMs: 0,
    cooldown: 0,
    icon: 'https://render.guildwars2.com/file/A33F6E0F51AD229AD57ED83D7AC040225DFD0FEA/103138.png',
    effects: [
      {
        name: 'Strike',
        type: 'strike',
        damageBreakdownName: 'Lesser Chilblains',
        weaponStrengthProfileId: 'nonweapon.unequipped',
        coefficient: 1.8,
        hits: 1
      },
      {
        name: 'Poisoned',
        type: 'condition',
        condition: 'Poisoned',
        stacks: 2,
        duration: 4
      },
      {
        name: 'Chilled',
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 2
      }
    ]
  },
  {
    id: ID.LESSER_MARK_OF_BLOOD,
    name: 'Lesser Mark of Blood',
    type: 'Proc',
    slot: 'Action',
    simulatorExcluded: true,
    slotSelectable: false,
    castTimeMs: 0,
    cooldown: 0,
    icon: 'https://render.guildwars2.com/file/F205B3A517DF27E3323D2FBCFE6C0FA3430242F9/103813.png',
    effects: [
      {
        name: 'Strike',
        type: 'strike',
        damageBreakdownName: 'Lesser Mark of Blood',
        weaponStrengthProfileId: 'nonweapon.unequipped',
        coefficient: 0.33,
        hits: 1
      },
      {
        name: 'Bleeding',
        type: 'condition',
        condition: 'Bleeding',
        stacks: 2,
        duration: 8
      },
      {
        name: 'Regeneration',
        type: 'boon',
        boon: 'regeneration',
        stacks: 1,
        duration: 5,
        audience: {
          recipients: 'party',
          maximumRecipients: 5
        }
      }
    ]
  },
  {
    id: ID.LESSER_SPINAL_SHIVERS,
    name: 'Lesser Spinal Shivers',
    type: 'Proc',
    slot: 'Action',
    simulatorExcluded: true,
    slotSelectable: false,
    castTimeMs: 0,
    cooldown: 16,
    icon: 'https://render.guildwars2.com/file/365608D62CC05CD6030EA30FEFD6D7D52EB002E7/103808.png',
    effects: [
      {
        type: 'strike',
        damageBreakdownName: 'Lesser Spinal Shivers',
        weaponStrengthProfileId: 'nonweapon.unequipped',
        coefficient: 0.6,
        hits: 1,
        name: 'Lesser Spinal Shivers - No Boons',
        canCrit: false,
        actorType: 'effect'
      },
      {
        name: 'Chilled',
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 5,
        actorType: 'effect'
      }
    ]
  },
  {
    id: ID.LESSER_SIGNET_OF_THE_LOCUST,
    name: 'Lesser Signet of the Locust',
    type: 'Proc',
    slot: 'Action',
    simulatorExcluded: true,
    slotSelectable: false,
    castTimeMs: 0,
    cooldown: 15,
    icon: 'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Lesser_Signet_of_the_Locust.png',
    effects: [
      {
        name: 'Strike',
        type: 'strike',
        damageBreakdownName: 'Lesser Signet of the Locust',
        weaponStrengthProfileId: 'nonweapon.unequipped',
        coefficient: 1,
        hits: 1
      }
    ]
  }
]);
