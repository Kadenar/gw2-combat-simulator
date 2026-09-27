/** Canonical Core warrior skill fragments grouped by their GW2 owner. */
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

export const WARRIOR_WEAPONS_STAFF_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.LINE_BREAKER]: {
    castTimeMs: 1167,
    effects: [
      {
        type: 'boon',
        boon: 'protection',
        duration: 4,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'aegis',
        duration: 4,
        stacks: 1
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 5
      }
    ]
  },
  [ID.DEFIANT_ROAR]: {
    castTimeMs: 333,
    sideEffects: [{ on: 'castComplete', do: { type: 'warrior.adrenaline', amount: 10 } }],
    effects: [
      {
        type: 'boon',
        boon: 'resolution',
        duration: 6,
        stacks: 1
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
  [ID.VALIANT_LEAP]: {
    castTimeMs: 500,
    sideEffects: [{ on: 'castComplete', do: { type: 'warrior.adrenaline', amount: 5 } }],
    effects: [
      {
        type: 'strike',
        coefficient: 1.25,
        hits: 1
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 8,
        stacks: 5
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 4,
        stacks: 1
      }
    ]
  },
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
        condition: 'Vulnerability',
        stacks: 6,
        duration: 6
      },
      {
        type: 'control',
        controlKind: 'pull'
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
  }
});
