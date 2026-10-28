/** Canonical Core warrior skill fragments grouped by their GW2 owner. */
import { BOON, CONDITION, CONTROL, RECIPIENT } from '#gw2/platform/constants.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';

export const WARRIOR_WEAPONS_STAFF_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.BALANCED_STRIKE]: {
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
});
