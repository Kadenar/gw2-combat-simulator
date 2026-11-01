/**
 * Owns Soulbeast merged-pet skill definitions for the Moa family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { CONDITION } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

export const SOULBEAST_MOA_BEAST_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.FRENZIED_ATTACK]: {
    name: 'Frenzied Attack',
    description: 'Attack with a pecking frenzy and make your foe vulnerable.',
    icon: 'https://render.guildwars2.com/file/E4C75BA1A9056A684EDDF0CBCB746B36D707A842/103007.png',
    type: 'Profession',
    slot: 'Profession_2',
    cooldown: 20,
    beastmodeSkill: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 5,
        atMs: 0
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 5,
        duration: 10
      }
    ]
  },
  [ID.HARMONIC_CRY]: {
    name: 'Harmonic Cry',
    description: 'Heal yourself and nearby allies.',
    icon: 'https://render.guildwars2.com/file/C8E6011DF9B8665510E9BC12186A01B64006A62A/103556.png',
    type: 'Profession',
    slot: 'Profession_1',
    cooldown: 25,
    beastmodeSkill: true,
    castTimeMs: 0,
    effects: []
  }
});
