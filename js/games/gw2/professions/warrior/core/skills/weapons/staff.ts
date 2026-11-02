/** Canonical Core warrior skill definitions grouped by their GW2 owner. */
import { BOON, CONDITION, CONTROL, RECIPIENT } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import type { WarriorSkill } from '#gw2/professions/warrior/types.js';

export const WARRIOR_WEAPONS_STAFF_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<WarriorSkill>>> = {
  [ID.BALANCED_STRIKE]: {
    name: 'Balanced Strike',
    icon: 'https://render.guildwars2.com/file/5A46D95EFC17B064B5CA15E359EE79781E267C01/3256398.png',
    type: 'Weapon',
    weapon: 'Staff',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 333,
    effects: [
      {
        type: 'strike',
        coefficient: 0.7,
        hits: 1
      }
    ]
  },
  [ID.REVERSE_STRIKE]: {
    name: 'Reverse Strike',
    icon: 'https://render.guildwars2.com/file/6695B5C7D53397BAD94C36030F2E40C005D7800B/3256399.png',
    type: 'Weapon',
    weapon: 'Staff',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 333,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1
      }
    ]
  },
  [ID.INSPIRING_WHIRL]: {
    name: 'Inspiring Whirl',
    icon: 'https://render.guildwars2.com/file/34647709920DE5053F94039C72AFB8D61180245D/3256400.png',
    type: 'Weapon',
    weapon: 'Staff',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      }
    ]
  },
  [ID.VALIANT_LEAP]: {
    name: 'Valiant Leap',
    icon: 'https://render.guildwars2.com/file/0CA82FBE1CD6160EB9C86A4CCA0F9EAD0F640AD5/3256401.png',
    type: 'Weapon',
    weapon: 'Staff',
    slot: 'Weapon_2',
    cooldown: 8,
    // Movement classification drives completed Brave Stride rewards.
    movementSkill: true,
    castTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 1.25,
        hits: 1
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.MIGHT,
        duration: 8,
        stacks: 5
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.FURY,
        duration: 4,
        stacks: 1
      }
    ],
    sideEffects: [{ on: 'castCommit', do: { type: 'warrior.grant-combat-resource', amount: 5 } }]
  },
  [ID.LINE_BREAKER]: {
    name: 'Line Breaker',
    icon: 'https://render.guildwars2.com/file/D2FDE2964747965873CAAC000DADBFCADA94EFD3/3256402.png',
    type: 'Weapon',
    weapon: 'Staff',
    slot: 'Weapon_3',
    cooldown: 12,
    // Movement classification drives completed Brave Stride rewards.
    movementSkill: true,
    castTimeMs: 1167,
    effects: [
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.PROTECTION,
        duration: 4,
        stacks: 1
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.AEGIS,
        duration: 4,
        stacks: 1
      },
      {
        type: 'condition',
        condition: CONDITION.WEAKNESS,
        stacks: 1,
        duration: 5
      }
    ]
  },
  [ID.SNAP_PULL]: {
    name: 'Snap Pull',
    icon: 'https://render.guildwars2.com/file/995EF2A5749B34B46BFEBB587D2F25FBC331B0DD/3256403.png',
    type: 'Weapon',
    weapon: 'Staff',
    slot: 'Weapon_4',
    cooldown: 12,
    castTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 6,
        duration: 6
      },
      {
        type: 'control',
        controlKind: CONTROL.PULL
      }
    ]
  },
  [ID.DEFIANT_ROAR]: {
    name: 'Defiant Roar',
    icon: 'https://render.guildwars2.com/file/71F4BA42421A36093D077AC2014039F9FF3B56C4/3256405.png',
    type: 'Weapon',
    weapon: 'Staff',
    slot: 'Weapon_5',
    cooldown: 25,
    castTimeMs: 333,
    effects: [
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.RESOLUTION,
        duration: 6,
        stacks: 1
      }
    ],
    sideEffects: [{ on: 'castCommit', do: { type: 'warrior.grant-combat-resource', amount: 10 } }]
  }
};
