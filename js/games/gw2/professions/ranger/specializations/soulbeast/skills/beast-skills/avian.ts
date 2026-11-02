/**
 * Owns Soulbeast merged-pet skill definitions for the Avian family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { BOON, COMBO_FINISHER, CONDITION, RECIPIENT } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { RangerSkill } from '#gw2/professions/ranger/types.js';

export const SOULBEAST_AVIAN_BEAST_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<RangerSkill>>> = {
  [ID.QUICKENING_SCREECH]: {
    name: 'Quickening Screech',
    icon: 'https://render.guildwars2.com/file/69F1291534027E0937A5C020FFEBCC96F301EC54/104048.png',
    type: 'Profession',
    slot: 'Profession_2',
    cooldown: 15,
    beastmodeSkill: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'boon',
        boon: BOON.SWIFTNESS,
        duration: 10,
        stacks: 1,
        // Merging makes the ranger the boon source, retaining normal player duration scaling.
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      }
    ]
  },
  [ID.SWOOP_ID_44991]: {
    name: 'Swoop',
    icon: 'https://render.guildwars2.com/file/FCCA3C61C308E1D625C70BD4CCB9F05051AE6F6F/104047.png',
    type: 'Profession',
    slot: 'Profession_1',
    cooldown: 10,
    beastmodeSkill: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1,
        // The merged leap can finish the same fields as its pet counterpart.
        comboFinishers: [{ ownerId: 'ranger', finisherType: COMBO_FINISHER.LEAP }]
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 5,
        duration: 6
      }
    ]
  }
};
