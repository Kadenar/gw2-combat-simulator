/** Canonical Core necromancer skill definitions grouped by their GW2 owner. */
import { ACTOR, CONDITION } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { lifeForceGrant } from '#gw2/professions/necromancer/core/skills/life-force-grants.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';

export const NECROMANCER_WEAPONS_FOCUS_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = {
  [ID.SOUL_GRASP]: {
    name: 'Soul Grasp',
    icon: 'https://render.guildwars2.com/file/FA5ADFEE0A3C38BC6B9A0E301E6DEFFF9C763A54/103137.png',
    type: 'Weapon',
    weapon: 'Focus',
    slot: 'Weapon_4',
    cooldown: 10,
    ammoCastLockout: 3,
    ammo: 3,

    castTimeMs: 520,
    effects: [
      {
        type: 'condition',
        // Only this selected application owns its accepted-impact reward.
        reactions: [
          {
            on: 'condition.applied',
            actor: ACTOR.PLAYER,
            packets: 'first',
            when: (_runtime, { event }) => event.sourceId === event.skillId,
            do: [lifeForceGrant({ id: 'life-force', unit: 'application', grant: { percent: 11 } })]
          }
        ],
        condition: CONDITION.VULNERABILITY,
        duration: 6,
        stacks: 5
      }
    ]
  },
  [ID.SPINAL_SHIVERS]: {
    name: 'Spinal Shivers',
    icon: 'https://render.guildwars2.com/file/365608D62CC05CD6030EA30FEFD6D7D52EB002E7/103808.png',
    type: 'Weapon',
    weapon: 'Focus',
    slot: 'Weapon_5',
    cooldown: 12,
    castTimeMs: 800,
    effects: [
      {
        type: 'strike',
        // Use the zero-boon strike until target boon removal is simulated.
        coefficient: 2.5,
        hits: 1,
        name: 'Spinal Shivers'
      },
      {
        type: 'condition',
        condition: CONDITION.CHILLED,
        stacks: 1,
        duration: 5
      }
    ]
  }
};
