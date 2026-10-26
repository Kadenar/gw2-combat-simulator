// Verified skill icons use ArenaNet render URLs directly so they share the simulator's CDN fallback handling.
import { RECIPIENT, ACTOR, BOON, CONDITION } from '#gw2/platform/constants.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

/** Invoked skills own their patchable payloads and recharge; traits own trigger eligibility. */
export const NECROMANCER_CORE_TRAIT_SKILLS: readonly Skill[] = Object.freeze([
  {
    name: 'Lesser Chilblains',
    id: ID.LESSER_CHILBLAINS,
    type: 'Proc',
    slot: 'Action',
    simulatorExcluded: true,
    slotSelectable: false,
    cooldown: 0,
    icon: 'https://render.guildwars2.com/file/A33F6E0F51AD229AD57ED83D7AC040225DFD0FEA/103138.png',
    castTimeMs: 0,
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
        name: CONDITION.POISONED,
        type: 'condition',
        condition: CONDITION.POISONED,
        stacks: 2,
        duration: 4
      },
      {
        name: CONDITION.CHILLED,
        type: 'condition',
        condition: CONDITION.CHILLED,
        stacks: 1,
        duration: 2
      }
    ]
  },
  {
    name: 'Lesser Mark of Blood',
    id: ID.LESSER_MARK_OF_BLOOD,
    type: 'Proc',
    slot: 'Action',
    simulatorExcluded: true,
    slotSelectable: false,
    cooldown: 0,
    icon: 'https://render.guildwars2.com/file/F205B3A517DF27E3323D2FBCFE6C0FA3430242F9/103813.png',
    castTimeMs: 0,
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
        name: CONDITION.BLEEDING,
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 2,
        duration: 8
      },
      {
        name: BOON.REGENERATION,
        type: 'boon',
        boon: BOON.REGENERATION,
        stacks: 1,
        duration: 5,
        audience: {
          recipients: RECIPIENT.PARTY,
          maximumRecipients: 5
        }
      }
    ]
  },
  {
    name: 'Lesser Spinal Shivers',
    id: ID.LESSER_SPINAL_SHIVERS,
    type: 'Proc',
    slot: 'Action',
    simulatorExcluded: true,
    slotSelectable: false,
    cooldown: 16,
    icon: 'https://render.guildwars2.com/file/365608D62CC05CD6030EA30FEFD6D7D52EB002E7/103808.png',
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        damageBreakdownName: 'Lesser Spinal Shivers',
        weaponStrengthProfileId: 'nonweapon.unequipped',
        coefficient: 0.6,
        hits: 1,
        name: 'Lesser Spinal Shivers - No Boons',
        canCrit: false,
        actorType: ACTOR.EFFECT
      },
      {
        name: CONDITION.CHILLED,
        type: 'condition',
        condition: CONDITION.CHILLED,
        stacks: 1,
        duration: 5,
        actorType: ACTOR.EFFECT
      }
    ]
  },
  {
    name: 'Lesser Signet of the Locust',
    id: ID.LESSER_SIGNET_OF_THE_LOCUST,
    type: 'Proc',
    slot: 'Action',
    simulatorExcluded: true,
    slotSelectable: false,
    cooldown: 15,
    icon: 'https://render.guildwars2.com/file/E9779110A24733AEAC403E48D6ADF00F9F3A0507/58463.png',
    castTimeMs: 0,
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
