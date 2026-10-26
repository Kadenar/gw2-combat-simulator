import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

/** Invoked skills own their payloads and recharge; traits retain only trigger eligibility and passive bonuses. */
export const SPELLBREAKER_TRAIT_SKILLS: readonly Skill[] = Object.freeze([
  {
    name: 'Magebane Tether',
    id: ID.MAGEBANE_TETHER,
    icon: 'https://render.guildwars2.com/file/040FEAA53CC4AE3273E753D16A585EA3C9452F6E/1770020.png',
    type: 'Proc',
    slot: 'Action',
    simulatorExcluded: true,
    slotSelectable: false,
    cooldown: 12,
    castTimeMs: 0,
    effects: [
      {
        name: 'magebane-tether',
        type: 'buff',
        kind: 'magebane-tether',
        stacks: 1,
        duration: 8,
        damageIncreasePerStack: 0.15
      }
    ]
  }
]);
