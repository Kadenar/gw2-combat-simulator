import type { Skill } from '#gw2/platform/engine/skills/types.js';

/** Synthetic identities stay shared across catalogs and saved rotations. */
export const SHARED_SKILL_IDS = Object.freeze({ SWAP_WEAPONS: -3, DODGE: -5 });

/** Declares the common swap action while retaining profession-owned recharge and bar behavior. */
export function createWeaponSwapSkill(
  overrides: Partial<Pick<Skill, 'cooldown' | 'inputCategory' | 'description'>> = {}
) {
  return {
    name: 'Swap Weapons',
    description: 'Swap equipped weapon sets.',
    icon: 'https://wiki.guildwars2.com/images/c/ce/Weapon_Swap_Button.png',
    type: 'Action',
    slot: 'Action',
    inputCategory: 'weapon-swap',
    castTimeMs: 0,
    cooldown: 10,
    rechargeIgnoresAlacrity: true,
    rechargeAnchor: 'castStart',
    ...overrides,
    id: SHARED_SKILL_IDS.SWAP_WEAPONS,
    effects: []
  } satisfies Skill;
}

/** Shares dodge presentation and base animation; each profession supplies its cost and selected variant. */
export function createDodgeSkill(
  overrides: Partial<
    Pick<
      Skill,
      | 'description'
      | 'cost'
      | 'castTimeMs'
      | 'interruptCommitMs'
      | 'retainsCastLockoutAfterInterrupt'
      | 'rechargeAnchor'
      | 'specialization'
      | 'categories'
      | 'skillFamily'
      | 'resourceCost'
      | 'tasks'
    >
  > = {}
) {
  return {
    name: 'Dodge',
    description: 'Perform a dodge roll.',
    icon: 'https://wiki.guildwars2.com/images/b/b2/Dodge.png',
    type: 'Action',
    slot: 'Action',
    castTimeMs: 800,
    cooldown: 0,
    ...overrides,
    id: SHARED_SKILL_IDS.DODGE,
    effects: []
  } satisfies Skill;
}
