import type { Skill } from '#gw2/platform/skills/types.js';

/** Guild actor attacks own their selected packets and repeat recharge; shared AI keeps engagement and lifetime. */
export const DEADEYE_GUILD_ATTACK_SKILLS: readonly Skill[] = Object.freeze([
  {
    id: 'thief.guild.deadeye.basic',
    name: 'Thieves Guild (Deadeye) \u2014 Basic Attack',
    displayName: 'Basic Attack',
    type: 'Proc',
    simulatorExcluded: true,
    castTimeMs: 0,
    cooldown: 1,
    specialization: 'Deadeye',
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
