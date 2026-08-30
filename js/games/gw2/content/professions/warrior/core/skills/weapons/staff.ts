/** Canonical Core warrior skill fragments grouped by their GW2 owner. */
import { WARRIOR_SKILL_IDS as ID } from '#gw2/content/professions/warrior/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const WARRIOR_WEAPONS_STAFF_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.LINE_BREAKER]: {
    implemented: true,
    quicknessCastTimeMs: 1167,
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
    implemented: true,
    quicknessCastTimeMs: 333,
    adrenalineGain: 10,
    handlerId: 'warrior.resource',
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
    implemented: true,
    quicknessCastTimeMs: 333,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1
      }
    ]
  },
  [ID.VALIANT_LEAP]: {
    implemented: true,
    quicknessCastTimeMs: 500,
    adrenalineGain: 5,
    handlerId: 'warrior.resource',
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
    implemented: true,
    quicknessCastTimeMs: 333,
    effects: [
      {
        type: 'strike',
        coefficient: 0.7,
        hits: 1
      }
    ]
  },
  [ID.SNAP_PULL]: {
    implemented: true,
    quicknessCastTimeMs: 500,
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
        metadata: {
          controlKind: 'pull'
        }
      }
    ]
  },
  [ID.INSPIRING_WHIRL]: {
    implemented: true,
    quicknessCastTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      }
    ]
  }
});
