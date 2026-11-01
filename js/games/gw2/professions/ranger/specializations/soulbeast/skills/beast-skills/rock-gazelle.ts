/**
 * Owns Soulbeast merged-pet skill definitions for the Rock Gazelle family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { CONDITION } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

export const SOULBEAST_ROCK_GAZELLE_BEAST_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.KICK]: {
    name: 'Kick',
    description: 'Kick your enemy.',
    icon: 'https://render.guildwars2.com/file/2ADAEF05DE5D0F031ACE310DB425E01CE7180416/1770575.png',
    type: 'Profession',
    slot: 'Profession_1',
    cooldown: 8,
    beastmodeSkill: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.94,
        hits: 1
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 3,
        duration: 6
      }
    ]
  },
  [ID.CHARGE]: {
    name: 'Charge',
    description: 'Charge at your target.',
    icon: 'https://render.guildwars2.com/file/9E1718ECB696EBE63CF7EE700306D2090DD8084B/1770573.png',
    type: 'Profession',
    slot: 'Profession_2',
    cooldown: 12,
    beastmodeSkill: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.565,
        hits: 1,
        name: 'Charge - Travel Damage'
      },
      {
        type: 'strike',
        coefficient: 1.13,
        hits: 1,
        name: 'Charge - Impact Damage'
      }
    ]
  }
});
