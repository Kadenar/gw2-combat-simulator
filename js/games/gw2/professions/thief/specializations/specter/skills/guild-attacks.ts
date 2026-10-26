import type { Skill } from '#gw2/platform/skills/types.js';

/** Guild actor attacks own their selected packets and repeat recharge; shared AI keeps engagement and lifetime. */
export const SPECTER_GUILD_ATTACK_SKILLS: readonly Skill[] = Object.freeze([
  {
    id: 67807,
    name: 'Thieves Guild (Specter) \u2014 Shadow Bolt',
    displayName: 'Shadow Bolt',
    type: 'Proc',
    simulatorExcluded: true,
    castTimeMs: 0,
    cooldown: 0,
    specialization: 'Specter',
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
    id: 67795,
    name: 'Thieves Guild (Specter) \u2014 Well of Sorrow',
    displayName: 'Well of Sorrow',
    type: 'Proc',
    simulatorExcluded: true,
    castTimeMs: 0,
    cooldown: 0,
    specialization: 'Specter',
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
    id: 67812,
    name: 'Thieves Guild (Specter) \u2014 Double Bolt',
    displayName: 'Double Bolt',
    type: 'Proc',
    simulatorExcluded: true,
    castTimeMs: 0,
    cooldown: 0,
    specialization: 'Specter',
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
    id: 67817,
    name: 'Thieves Guild (Specter) \u2014 Triple Bolt',
    displayName: 'Triple Bolt',
    type: 'Proc',
    simulatorExcluded: true,
    castTimeMs: 0,
    cooldown: 0,
    specialization: 'Specter',
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
    id: 67818,
    name: 'Thieves Guild (Specter) \u2014 Triple Threat',
    displayName: 'Triple Threat',
    type: 'Proc',
    simulatorExcluded: true,
    castTimeMs: 0,
    cooldown: 0,
    specialization: 'Specter',
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
]);
