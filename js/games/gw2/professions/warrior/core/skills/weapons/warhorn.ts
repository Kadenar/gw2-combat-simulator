import { COMBO_FINISHER, RECIPIENT, BOON } from '#gw2/platform/constants.js';
/** Canonical Core warrior skill fragments grouped by their GW2 owner. */
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

export const WARRIOR_WEAPONS_WARHORN_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.CHARGE]: {
    castTimeMs: 333,
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: COMBO_FINISHER.BLAST,
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: [
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.SWIFTNESS,
        duration: 20,
        stacks: 1
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.QUICKNESS,
        duration: 2,
        stacks: 1
      }
    ]
  },
  [ID.CALL_OF_VALOR]: {
    castTimeMs: 333,
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: COMBO_FINISHER.BLAST,
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: [
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.VIGOR,
        duration: 10,
        stacks: 1
      }
    ]
  }
});
