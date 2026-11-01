/**
 * Owns Soulbeast merged-pet skill definitions for the Aether Hunter family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { CONDITION } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

export const SOULBEAST_AETHER_HUNTER_BEAST_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.LEY_LINE_VORTEX]: {
    name: 'Ley-Line Vortex',
    description:
      'Spin around, creating a vortex of ley-line energy around you that strikes and inflicts conditions on enemies.',
    icon: 'https://render.guildwars2.com/file/030E7AB1CB18A4B348FD17B54B2B68FDABDB1DBC/3124961.png',
    type: 'Profession',
    slot: 'Profession_2',
    cooldown: 20,
    beastmodeSkill: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 2.8,
        hits: 8,
        atMs: 0
      },
      {
        type: 'condition',
        condition: CONDITION.TORMENT,
        stacks: 1,
        duration: 6
      }
    ]
  },
  [ID.LUNGE]: {
    name: 'Lunge',
    description: 'Lunge forward, crippling opponents in the path.',
    icon: 'https://render.guildwars2.com/file/B65ECEBB72F4F10C4144510777E899E477DEE5B2/3124960.png',
    type: 'Profession',
    slot: 'Profession_1',
    cooldown: 8,
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
        duration: 5
      }
    ]
  }
});
