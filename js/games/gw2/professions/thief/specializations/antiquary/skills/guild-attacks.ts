import type { Skill } from '#gw2/platform/skills/types.js';

/** Guild actor attacks own their selected packets and repeat recharge; shared AI keeps engagement and lifetime. */
export const ANTIQUARY_GUILD_ATTACK_SKILLS: readonly Skill[] = [
  {
    name: 'Thieves Guild (Antiquary) \u2014 Basic Attack',
    icon: 'https://render.guildwars2.com/file/C314B19D687453E02BC5B5BB4137903A12267AF1/104093.png',
    id: 'thief.guild.antiquary.basic',
    displayName: 'Basic Attack',
    type: 'Proc',
    rotationInputExcluded: true,
    castTimeMs: 0,
    cooldown: 1,
    effects: [
      {
        type: 'strike',
        atMs: 0,
        name: 'Strike',
        coefficient: 1.2,
        hits: 1,
        sourceId: 13082
      }
    ]
  }
];
