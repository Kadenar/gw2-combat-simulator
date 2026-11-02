import type { Skill } from '#gw2/platform/skills/types.js';

/** Guild actor attacks own their selected packets and repeat recharge; shared AI keeps engagement and lifetime. */
export const CORE_GUILD_ATTACK_SKILLS: readonly Skill[] = [
  {
    name: 'Thieves Guild (Core) - Black Powder',
    icon: 'https://render.guildwars2.com/file/C314B19D687453E02BC5B5BB4137903A12267AF1/104093.png',
    id: 3669,
    displayName: 'Black Powder',
    type: 'Proc',
    rotationInputExcluded: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        atMs: 0,
        name: 'Strike',
        coefficient: 0.8,
        hits: 1,
        sourceId: 3669
      }
    ]
  },
  {
    name: 'Thieves Guild (Core) - Unload',
    icon: 'https://render.guildwars2.com/file/C314B19D687453E02BC5B5BB4137903A12267AF1/104093.png',
    id: 3666,
    displayName: 'Unload',
    type: 'Proc',
    rotationInputExcluded: true,
    castTimeMs: 0,
    cooldown: 5.8,
    effects: [
      {
        type: 'strike',
        atMs: 0,
        name: 'Strike',
        coefficient: 2.0999999999999996,
        hits: 12,
        sourceId: 3666
      }
    ]
  },
  {
    name: 'Thieves Guild (Core) - Scorpion Wire',
    icon: 'https://render.guildwars2.com/file/C314B19D687453E02BC5B5BB4137903A12267AF1/104093.png',
    id: 3665,
    displayName: 'Scorpion Wire',
    type: 'Proc',
    rotationInputExcluded: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        atMs: 0,
        name: 'Strike',
        coefficient: 1.5,
        hits: 1,
        sourceId: 3665
      },
      {
        type: 'condition',
        name: 'Poisoned',
        condition: 'Poisoned',
        stacks: 2,
        duration: 10,
        sourceId: 3665
      },
      {
        type: 'condition',
        name: 'Weakness',
        condition: 'Weakness',
        stacks: 1,
        duration: 4,
        sourceId: 3665
      }
    ]
  },
  {
    name: 'Thieves Guild (Core) - Twisting Fang I',
    icon: 'https://render.guildwars2.com/file/C314B19D687453E02BC5B5BB4137903A12267AF1/104093.png',
    id: 3661,
    displayName: 'Twisting Fang I',
    type: 'Proc',
    rotationInputExcluded: true,
    castTimeMs: 0,
    cooldown: 2.68,
    effects: [
      {
        type: 'strike',
        atMs: 0,
        name: 'Strike',
        coefficient: 1.2,
        hits: 2,
        sourceId: 3661
      }
    ]
  },
  {
    name: 'Thieves Guild (Core) - Twisting Fang II',
    icon: 'https://render.guildwars2.com/file/C314B19D687453E02BC5B5BB4137903A12267AF1/104093.png',
    id: 3662,
    displayName: 'Twisting Fang II',
    type: 'Proc',
    rotationInputExcluded: true,
    castTimeMs: 0,
    cooldown: 2.68,
    effects: [
      {
        type: 'strike',
        atMs: 0,
        name: 'Strike',
        coefficient: 1.6,
        hits: 1,
        sourceId: 3662
      }
    ]
  },
  {
    name: 'Thieves Guild (Core) - Twisting Fang III',
    icon: 'https://render.guildwars2.com/file/C314B19D687453E02BC5B5BB4137903A12267AF1/104093.png',
    id: 3663,
    displayName: 'Twisting Fang III',
    type: 'Proc',
    rotationInputExcluded: true,
    castTimeMs: 0,
    cooldown: 2.68,
    effects: [
      {
        type: 'strike',
        atMs: 0,
        name: 'Strike',
        coefficient: 2.5,
        hits: 1,
        sourceId: 3663
      }
    ]
  },
  {
    name: 'Thieves Guild (Core) - Basic Attack',
    icon: 'https://render.guildwars2.com/file/C314B19D687453E02BC5B5BB4137903A12267AF1/104093.png',
    id: 'thief.guild.core.basic',
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
