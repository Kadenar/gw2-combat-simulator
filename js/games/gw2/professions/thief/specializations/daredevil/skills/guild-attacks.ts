import type { Skill } from '#gw2/platform/skills/types.js';

/** Guild actor attacks own their selected packets and repeat recharge; shared AI keeps engagement and lifetime. */
export const DAREDEVIL_GUILD_ATTACK_SKILLS: readonly Skill[] = [
  {
    name: 'Thieves Guild (Daredevil) - Vault',
    icon: 'https://render.guildwars2.com/file/C314B19D687453E02BC5B5BB4137903A12267AF1/104093.png',
    id: 41056,
    displayName: 'Vault',
    type: 'Proc',
    rotationInputExcluded: true,
    castTimeMs: 0,
    cooldown: 11.36,
    effects: [
      {
        type: 'strike',
        atMs: 0,
        name: 'Strike',
        coefficient: 2.4,
        hits: 1,
        sourceId: 41056
      }
    ]
  },
  {
    name: 'Thieves Guild (Daredevil) - Impairing Daggers',
    icon: 'https://render.guildwars2.com/file/C314B19D687453E02BC5B5BB4137903A12267AF1/104093.png',
    id: 40482,
    displayName: 'Impairing Daggers',
    type: 'Proc',
    rotationInputExcluded: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        atMs: 0,
        name: 'Strike',
        coefficient: 0.75,
        hits: 3,
        sourceId: 40482
      },
      {
        type: 'condition',
        name: 'Poisoned',
        condition: 'Poisoned',
        stacks: 3,
        duration: 8,
        sourceId: 40482
      },
      {
        type: 'condition',
        name: 'Slow',
        condition: 'Slow',
        stacks: 1,
        duration: 4,
        sourceId: 40482
      },
      {
        type: 'condition',
        name: 'Immobilized',
        condition: 'Immobilized',
        stacks: 1,
        duration: 2,
        sourceId: 40482
      }
    ]
  },
  {
    name: 'Thieves Guild (Daredevil) - Weakening Charge',
    icon: 'https://render.guildwars2.com/file/C314B19D687453E02BC5B5BB4137903A12267AF1/104093.png',
    id: 40005,
    displayName: 'Weakening Charge',
    type: 'Proc',
    rotationInputExcluded: true,
    castTimeMs: 0,
    cooldown: 3.36,
    effects: [
      {
        type: 'strike',
        atMs: 0,
        name: 'Strike',
        coefficient: 0.9,
        hits: 2,
        sourceId: 40005
      }
    ]
  }
];
