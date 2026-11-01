/**
 * Owns Soulbeast merged-pet skill definitions for the Spider family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { CONDITION } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

export const SOULBEAST_SPIDER_BEAST_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.POISON_GAS]: {
    name: 'Poison Gas',
    description: 'Spit a ball of venom that covers an area with a poisonous cloud.',
    icon: 'https://render.guildwars2.com/file/35235BAFD3925C453F7C900B97C4384BA8EE4693/104051.png',
    type: 'Profession',
    slot: 'Profession_2',
    cooldown: 15,
    beastmodeSkill: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'condition',
        condition: CONDITION.POISONED,
        stacks: 1,
        duration: 6
      }
    ]
  },
  [ID.ENTANGLING_WEB]: {
    name: 'Entangling Web',
    description: 'Shoot a web, immobilizing your foe.',
    icon: 'https://render.guildwars2.com/file/33284077006B957ABA0608ED02033CB61FED3D46/104026.png',
    type: 'Profession',
    slot: 'Profession_1',
    cooldown: 20,
    beastmodeSkill: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1
      },
      // The merged spider web immobilizes on impact (wiki: Entangling_Web_(soulbeast), PvE).
      { type: 'condition', condition: CONDITION.IMMOBILIZED, stacks: 1, duration: 3 }
    ]
  }
});
