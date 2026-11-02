import type { Skill } from '#gw2/platform/skills/types.js';

/** Guild actor attacks own their selected packets and repeat recharge; shared AI keeps engagement and lifetime. */
export const SPECTER_GUILD_ATTACK_SKILLS: readonly Skill[] = [
  {
    name: 'Thieves Guild (Specter) \u2014 Shadow Bolt',
    icon: 'https://render.guildwars2.com/file/C314B19D687453E02BC5B5BB4137903A12267AF1/104093.png',
    id: 67807,
    displayName: 'Shadow Bolt',
    type: 'Proc',
    rotationInputExcluded: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        atMs: 0,
        name: 'Strike',
        coefficient: 0.33,
        hits: 1,
        sourceId: 67807
      },
      {
        type: 'condition',
        name: 'Torment',
        condition: 'Torment',
        stacks: 1,
        duration: 2,
        sourceId: 67807
      }
    ]
  },
  {
    name: 'Thieves Guild (Specter) \u2014 Well of Sorrow',
    icon: 'https://render.guildwars2.com/file/C314B19D687453E02BC5B5BB4137903A12267AF1/104093.png',
    id: 67795,
    displayName: 'Well of Sorrow',
    type: 'Proc',
    rotationInputExcluded: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        atMs: 0,
        name: 'Strike',
        coefficient: 0.33,
        hits: 1,
        sourceId: 67795
      },
      {
        type: 'condition',
        name: 'Poisoned',
        condition: 'Poisoned',
        stacks: 1,
        duration: 3,
        sourceId: 67795
      },
      {
        type: 'condition',
        name: 'Bleeding',
        condition: 'Bleeding',
        stacks: 2,
        duration: 4,
        sourceId: 67795
      },
      {
        type: 'condition',
        name: 'Torment',
        condition: 'Torment',
        stacks: 2,
        duration: 4,
        sourceId: 67795
      },
      {
        type: 'condition',
        name: 'Fallback Torment',
        condition: 'Torment',
        stacks: 1,
        duration: 4,
        sourceId: 67795
      }
    ]
  },
  {
    name: 'Thieves Guild (Specter) \u2014 Double Bolt',
    icon: 'https://render.guildwars2.com/file/C314B19D687453E02BC5B5BB4137903A12267AF1/104093.png',
    id: 67812,
    displayName: 'Double Bolt',
    type: 'Proc',
    rotationInputExcluded: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        atMs: 0,
        name: 'Strike',
        coefficient: 0.375,
        hits: 1,
        sourceId: 67812
      },
      {
        type: 'condition',
        name: 'Torment',
        condition: 'Torment',
        stacks: 1,
        duration: 2,
        sourceId: 67812
      }
    ]
  },
  {
    name: 'Thieves Guild (Specter) \u2014 Triple Bolt',
    icon: 'https://render.guildwars2.com/file/C314B19D687453E02BC5B5BB4137903A12267AF1/104093.png',
    id: 67817,
    displayName: 'Triple Bolt',
    type: 'Proc',
    rotationInputExcluded: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        atMs: 0,
        name: 'Strike',
        coefficient: 0.45,
        hits: 1,
        sourceId: 67817
      },
      {
        type: 'condition',
        name: 'Torment',
        condition: 'Torment',
        stacks: 1,
        duration: 2,
        sourceId: 67817
      }
    ]
  },
  {
    name: 'Thieves Guild (Specter) \u2014 Triple Threat',
    icon: 'https://render.guildwars2.com/file/C314B19D687453E02BC5B5BB4137903A12267AF1/104093.png',
    id: 67818,
    displayName: 'Triple Threat',
    type: 'Proc',
    rotationInputExcluded: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        atMs: 0,
        name: 'Strike',
        coefficient: 0.45,
        hits: 1,
        sourceId: 67818
      },
      {
        type: 'condition',
        name: 'Torment',
        condition: 'Torment',
        stacks: 1,
        duration: 2,
        sourceId: 67818
      }
    ]
  }
];
