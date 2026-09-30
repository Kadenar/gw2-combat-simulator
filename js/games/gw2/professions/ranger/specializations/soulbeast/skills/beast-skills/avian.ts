/**
 * Owns Soulbeast merged-pet skill fragments for the Avian family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

export const SOULBEAST_AVIAN_BEAST_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.QUICKENING_SCREECH]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 10,
        stacks: 1,
        // Merging makes the ranger the boon source, retaining normal player duration scaling.
        audience: { recipients: 'party', maximumRecipients: 5 }
      }
    ]
  },
  [ID.SWOOP_ID_44991]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1,
        // The merged leap can finish the same fields as its pet counterpart.
        comboFinishers: [{ ownerId: 'ranger', finisherType: 'Leap', ambiguousFieldSelection: 'oldest' }]
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 5,
        duration: 6
      }
    ]
  }
});
