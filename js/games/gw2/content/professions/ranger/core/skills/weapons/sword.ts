/** Canonical Core ranger skill fragments grouped by their GW2 owner. */
import { RANGER_SKILL_IDS as ID } from '#gw2/content/professions/ranger/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const RANGER_CORE_SWORD_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.SLASH]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1
      }
    ],
    quicknessCastTimeMs: 480
  },
  [ID.CRIPPLING_THRUST]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 2
      }
    ],
    quicknessCastTimeMs: 320
  },
  [ID.PRECISION_SWIPE]: {
    effects: [
      {
        type: 'strike',
        coefficient: 1.4,
        hits: 1
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 5,
        stacks: 1,
        audience: { recipients: 'summons' as const, affectsSelf: false, maximumRecipients: 1 }
      }
    ],
    quicknessCastTimeMs: 600
  },
  [ID.SERPENTS_STRIKE]: {
    evades: true,
    effects: [
      {
        type: 'strike',
        coefficient: 3,
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
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 3
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 6
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 3
      }
    ],
    quicknessCastTimeMs: 1000
  },
  [ID.POUNCE]: {
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        damageKind: 'ranger-pounce-defiant',
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: 'Leap',
            ambiguousFieldSelection: 'oldest'
          }
        ]
      },
      {
        type: 'boon',
        boon: 'vigor',
        duration: 3,
        stacks: 1
      }
    ],
    quicknessCastTimeMs: 840
  }
});
