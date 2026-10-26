import type { Skill } from '#gw2/platform/skills/types.js';

/** Guild actor attacks own their selected packets and repeat recharge; shared AI keeps engagement and lifetime. */
export const DAREDEVIL_GUILD_ATTACK_SKILLS: readonly Skill[] = Object.freeze([
  {
    id: 41056,
    name: 'Thieves Guild (Daredevil) \u2014 Vault',
    displayName: 'Vault',
    type: 'Proc',
    simulatorExcluded: true,
    castTimeMs: 0,
    cooldown: 11.36,
    specialization: 'Daredevil',
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
    id: 40482,
    name: 'Thieves Guild (Daredevil) \u2014 Impairing Daggers',
    displayName: 'Impairing Daggers',
    type: 'Proc',
    simulatorExcluded: true,
    castTimeMs: 0,
    cooldown: 0,
    specialization: 'Daredevil',
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
    id: 40005,
    name: 'Thieves Guild (Daredevil) \u2014 Weakening Charge',
    displayName: 'Weakening Charge',
    type: 'Proc',
    simulatorExcluded: true,
    castTimeMs: 0,
    cooldown: 3.36,
    specialization: 'Daredevil',
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
]);
