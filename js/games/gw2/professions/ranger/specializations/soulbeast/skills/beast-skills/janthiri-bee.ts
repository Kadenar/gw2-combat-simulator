/**
 * Owns Soulbeast merged-pet skill definitions for the Janthiri Bee family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { CONDITION, CONTROL } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { RangerSkill } from '#gw2/professions/ranger/types.js';

export const SOULBEAST_JANTHIRI_BEE_BEAST_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<RangerSkill>>> = {
  [ID.BUMBLE]: {
    name: 'Bumble',
    icon: 'https://render.guildwars2.com/file/DCA96000060D21F6E4A9600DB3D8A90CE8AB574B/3594073.png',
    type: 'Profession',
    slot: 'Profession_1',
    cooldown: 24,
    beastmodeSkill: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      },
      // The merged charge knocks down its target, enabling disable-triggered traits such as Twice as Vicious.
      { type: 'control', controlKind: CONTROL.KNOCKDOWN }
    ]
  },
  [ID.STINGING_SORROW]: {
    name: 'Stinging Sorrow',
    icon: 'https://render.guildwars2.com/file/7869ABC7D2937825AD34ECEEF9014801BA11EB53/3594076.png',
    type: 'Profession',
    slot: 'Profession_2',
    cooldown: 20,
    beastmodeSkill: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 5,
        atMs: 0
      },
      {
        type: 'condition',
        condition: CONDITION.POISONED,
        stacks: 5,
        duration: 7
      }
    ]
  }
};
