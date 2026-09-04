/**
 * Owns synthetic Core Engineer actions that do not come from the GW2 skill catalog.
 * Runtime behavior remains in the named skill or mechanic handler owners.
 */
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import { ENGINEER_ELITE_MORTAR_KIT_EXTRA_SKILLS } from '#gw2/professions/engineer/core/skills/kits/elite-mortar-kit.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

const extraSkills: Skill[] = [
  ...ENGINEER_ELITE_MORTAR_KIT_EXTRA_SKILLS,
  {
    id: ID.DODGE,
    name: 'Dodge',
    description: 'Perform a dodge roll.',
    icon: 'https://wiki.guildwars2.com/images/b/b2/Dodge.png',
    type: 'Action',
    slot: 'Action',
    // Custom: Spends endurance and emits the Engineer dodge state; see `dodge.ts`.
    handlerId: 'engineer.dodge',
    // Quickness does not shorten the fixed evade animation recorded for ordinary dodge rolls.
    unaffectedByQuickness: true,
    castTimeMs: 800,
    cooldown: 0,
    effects: []
  },
  {
    id: ID.SWAP_WEAPONS,
    name: 'Swap Weapons',
    description: 'Stow the active engineer kit and return to equipped weapons.',
    icon: 'https://wiki.guildwars2.com/images/c/ce/Weapon_Swap_Button.png',
    type: 'Action',
    slot: 'Action',
    // Custom: Stows the active kit and restores weapon state; see `../mechanics/kits.ts`.
    handlerId: 'engineer.kit-stow',
    castTimeMs: 0,
    cooldown: 0,
    rechargeAnchor: 'castStart',
    effects: []
  }
];

/** Supplies the frozen synthetic-action catalog to Core module composition. */
export const ENGINEER_CORE_EXTRA_SKILLS = Object.freeze(extraSkills.map((skill) => Object.freeze(skill)));
