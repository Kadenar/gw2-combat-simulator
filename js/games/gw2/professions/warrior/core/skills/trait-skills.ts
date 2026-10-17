import { BOON, boonKey } from '#gw2/platform/effects/boons.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

/** Invoked skills own their patchable payloads and recharge; traits own trigger eligibility. */
export const WARRIOR_CORE_TRAIT_SKILLS: readonly Skill[] = Object.freeze([
  {
    id: ID.LESSER_SIGNET_OF_MIGHT,
    name: 'Lesser Signet of Might',
    type: 'Proc',
    slot: 'Action',
    simulatorExcluded: true,
    slotSelectable: false,
    castTimeMs: 0,
    cooldown: 20,
    icon: 'https://render.guildwars2.com/file/450973A6DE4D0BEE580256F5759F632B7EBC7ADD/103798.png',
    effects: [
      {
        name: boonKey(BOON.MIGHT),
        type: 'boon',
        boon: BOON.MIGHT,
        stacks: 10,
        duration: 6
      }
    ]
  }
]);
