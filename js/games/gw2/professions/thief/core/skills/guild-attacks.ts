import type { Skill } from '#gw2/platform/skills/types.js';

/** Guild actor attacks own their selected packets and repeat recharge; shared AI keeps engagement and lifetime. */
export const CORE_GUILD_ATTACK_SKILLS: readonly Skill[] = Object.freeze([
  {
    id: 3669,
    name: 'Thieves Guild (Core) \u2014 Black Powder',
    displayName: 'Black Powder',
    type: 'Proc',
    simulatorExcluded: true,
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
    id: 3666,
    name: 'Thieves Guild (Core) \u2014 Unload',
    displayName: 'Unload',
    type: 'Proc',
    simulatorExcluded: true,
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
    id: 3665,
    name: 'Thieves Guild (Core) \u2014 Scorpion Wire',
    displayName: 'Scorpion Wire',
    type: 'Proc',
    simulatorExcluded: true,
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
    id: 3661,
    name: 'Thieves Guild (Core) \u2014 Twisting Fang I',
    displayName: 'Twisting Fang I',
    type: 'Proc',
    simulatorExcluded: true,
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
    id: 3662,
    name: 'Thieves Guild (Core) \u2014 Twisting Fang II',
    displayName: 'Twisting Fang II',
    type: 'Proc',
    simulatorExcluded: true,
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
    id: 3663,
    name: 'Thieves Guild (Core) \u2014 Twisting Fang III',
    displayName: 'Twisting Fang III',
    type: 'Proc',
    simulatorExcluded: true,
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
    id: 'thief.guild.core.basic',
    name: 'Thieves Guild (Core) \u2014 Basic Attack',
    displayName: 'Basic Attack',
    type: 'Proc',
    simulatorExcluded: true,
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
]);
