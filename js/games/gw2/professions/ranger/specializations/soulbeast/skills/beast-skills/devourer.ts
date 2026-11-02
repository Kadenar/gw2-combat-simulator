/**
 * Owns Soulbeast merged-pet skill definitions for the Devourer family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { CONTROL } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { RangerSkill } from '#gw2/professions/ranger/types.js';

export const SOULBEAST_DEVOURER_BEAST_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<RangerSkill>>> = {
  [ID.DEVOURER_RETREAT]: {
    name: 'Devourer Retreat',
    icon: 'https://render.guildwars2.com/file/70BE910B2E6366126B9B9F9C91F227CF9D73E99A/103564.png',
    type: 'Profession',
    slot: 'Profession_2',
    cooldown: 15,
    beastmodeSkill: true,
    castTimeMs: 0,
    effects: []
  },
  [ID.TAIL_LASH]: {
    name: 'Tail Lash',
    icon: 'https://render.guildwars2.com/file/086363EFF41571AD74CD1B506DF2B2F6F1F038D1/104029.png',
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
      {
        // The merged Tail Lash disables foes just like the pet skill, including on-disable trait triggers.
        type: 'control',
        controlKind: CONTROL.KNOCKBACK
      }
    ]
  }
};
