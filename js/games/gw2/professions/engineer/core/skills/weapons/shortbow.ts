/** Canonical Core engineer skill definitions grouped by their GW2 owner. */
import { ACTOR, BOON, CONDITION, CONTROL, RECIPIENT } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';

/** Defines Engineer shortbow essence and detonation skill effects. */
export const ENGINEER_WEAPONS_SHORTBOW_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = {
  [ID.ARC_DETONATOR]: {
    name: 'Arc Detonator',
    icon: 'https://render.guildwars2.com/file/6BDE493CFF0A2D03DC335B5D0BB910334FF3EF69/3256344.png',
    type: 'Weapon',
    weapon: 'Shortbow',
    slot: 'Weapon_1',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        coefficient: 0.3,
        hits: 1,
        name: 'Arc Detonator — Packet 1',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'strike',
        coefficient: 0.2,
        hits: 1,
        name: 'Shock Damage',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 1,
        duration: 8,
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.ESSENCE_OF_ANIMATED_SAND]: {
    name: 'Essence of Animated Sand',
    icon: 'https://render.guildwars2.com/file/CC492703C0E32598AA216BBFBB0F13D1F914A11B/3256345.png',
    type: 'Weapon',
    weapon: 'Shortbow',
    slot: 'Weapon_2',
    cooldown: 8,
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Essence of Animated Sand',
        actorType: ACTOR.PLAYER
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
        boon: BOON.MIGHT,
        duration: 8,
        stacks: 3
      }
    ]
  },
  [ID.ESSENCE_OF_LIVING_SHADOWS]: {
    name: 'Essence of Living Shadows',
    icon: 'https://render.guildwars2.com/file/0C703A07EA6CEBDFB1C215D7031D6A0847C90B9B/3256346.png',
    type: 'Weapon',
    weapon: 'Shortbow',
    slot: 'Weapon_3',
    cooldown: 15,
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        // Only the initial detonation deals damage; subsequent pulses heal allies.
        coefficient: 1,
        hits: 1,
        name: 'Essence of Living Shadows',
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.ESSENCE_OF_LIQUID_WRATH]: {
    name: 'Essence of Liquid Wrath',
    icon: 'https://render.guildwars2.com/file/BE259B21EBBEBD0EFACE6D6A67D72E680A0EEC0C/3256347.png',
    type: 'Weapon',
    weapon: 'Shortbow',
    slot: 'Weapon_4',
    cooldown: 20,
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        coefficient: 1.32,
        hits: 1,
        name: 'Essence of Liquid Wrath',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.PROTECTION,
        duration: 5,
        stacks: 1
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.AEGIS,
        duration: 5,
        stacks: 1
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.PROTECTION,
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.ESSENCE_OF_BORROWED_TIME]: {
    name: 'Essence of Borrowed Time',
    icon: 'https://render.guildwars2.com/file/66F1785E4BC81BA137BC1478C6063D0B35D547AE/3256348.png',
    type: 'Weapon',
    weapon: 'Shortbow',
    slot: 'Weapon_5',
    cooldown: 25,
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: 'Essence of Borrowed Time',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.DAZE
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.STUN
      }
    ]
  }
};
