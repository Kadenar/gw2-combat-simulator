/**
 * Owns Soulbeast merged-pet skill definitions for the Smokescale family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { BOON, CONDITION } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

export const SOULBEAST_SMOKESCALE_BEAST_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.SMOKE_ASSAULT]: {
    name: 'Smoke Assault',
    description: 'Conceal yourself and lash out at nearby foes. Gain might each time you damage a foe.',
    icon: 'https://render.guildwars2.com/file/9B9A0403F90E7C7C2367F2995923477F67B0077F/1128612.png',
    type: 'Profession',
    slot: 'Profession_2',
    cooldown: 20,
    beastmodeSkill: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1
      },
      {
        type: 'strike',
        coefficient: 0.35,
        hits: 1
      },
      {
        type: 'boon',
        boon: BOON.MIGHT,
        duration: 8,
        stacks: 1
      },
      {
        type: 'boon',
        boon: BOON.MIGHT,
        duration: 6,
        stacks: 1
      }
    ]
  },
  [ID.TAKEDOWN]: {
    name: 'Takedown',
    description: 'Cripple your target with a powerful strike.',
    icon: 'https://render.guildwars2.com/file/1B7A03496B93AEC937923F229E062F2AD14DFA24/1128611.png',
    type: 'Profession',
    slot: 'Profession_1',
    cooldown: 10,
    beastmodeSkill: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 3
      }
    ]
  }
});
