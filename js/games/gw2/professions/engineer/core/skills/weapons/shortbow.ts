/** Canonical Core engineer skill fragments grouped by their GW2 owner. */
import { ACTOR, BOON, CONDITION, CONTROL, RECIPIENT } from '#gw2/platform/constants.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';

/** Defines Engineer shortbow essence and detonation skill effects. */
export const ENGINEER_WEAPONS_SHORTBOW_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.ARC_DETONATOR]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
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
});
