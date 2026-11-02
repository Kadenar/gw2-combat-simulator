/** Canonical Core warrior skill definitions grouped by their GW2 owner. */
import { CONTROL } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';

export const WARRIOR_WEAPONS_SHIELD_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = {
  [ID.SHIELD_BASH]: {
    name: 'Shield Bash',
    icon: 'https://render.guildwars2.com/file/0DB2EBFB326833CE9654010A5915FB387B02BB4D/103002.png',
    type: 'Weapon',
    weapon: 'Shield',
    slot: 'Weapon_4',
    cooldown: 20,
    castTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      },
      {
        type: 'control',
        controlKind: CONTROL.STUN
      }
    ]
  },
  [ID.SHIELD_STANCE]: {
    name: 'Shield Stance',
    icon: 'https://render.guildwars2.com/file/10E4931AC6BB5824CACE5A09E07E512869904DB9/102859.png',
    type: 'Weapon',
    weapon: 'Shield',
    slot: 'Weapon_5',
    cooldown: 25,
    castTimeMs: 2000,
    effects: []
  }
};
