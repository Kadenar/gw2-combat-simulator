import { BOON } from '#gw2/platform/constants.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';

/** Invoked skills own their patchable payloads and recharge; traits own trigger eligibility. */
export const WARRIOR_CORE_TRAIT_SKILLS: readonly Skill[] = [
  {
    name: 'Lesser Signet of Might',
    icon: 'https://render.guildwars2.com/file/450973A6DE4D0BEE580256F5759F632B7EBC7ADD/103798.png',
    id: ID.LESSER_SIGNET_OF_MIGHT,
    type: 'Proc',
    slot: 'Action',
    rotationInputExcluded: true,
    slotSelectable: false,
    cooldown: 20,
    castTimeMs: 0,
    effects: [
      {
        name: BOON.MIGHT,
        type: 'boon',
        boon: BOON.MIGHT,
        stacks: 10,
        duration: 6
      }
    ]
  }
];
