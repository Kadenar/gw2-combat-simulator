import type { Skill } from '#gw2/platform/skills/types.js';

/** Guild actor attacks own their selected packets and repeat recharge; shared AI keeps engagement and lifetime. */
export const ANTIQUARY_GUILD_ATTACK_SKILLS: readonly Skill[] = Object.freeze([
  {
    id: 'thief.guild.antiquary.basic',
    name: 'Thieves Guild (Antiquary) \u2014 Basic Attack',
    displayName: 'Basic Attack',
    type: 'Proc',
    simulatorExcluded: true,
    castTimeMs: 0,
    cooldown: 1,
    specialization: 'Antiquary',
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
