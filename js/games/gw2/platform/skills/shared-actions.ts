import { ENDURANCE } from '#gw2/platform/combat/resources/endurance-rules.js';
import type { Skill } from '#gw2/platform/skills/types.js';

// Share URL identities in headless catalogs as well as browser bundles.
export const DODGE_ICON = new URL('@images/wiki/dodge.png', import.meta.url).href;

export const WEAPON_SWAP_ICON = new URL('@images/wiki/weapon-swap-button.png', import.meta.url).href;

/** Synthetic identities stay shared across catalogs and saved rotations. */
export const SHARED_SKILL_IDS = Object.freeze({ SWAP_WEAPONS: -3, DODGE: -5 });

/** Declares the common swap action while retaining profession-owned recharge and bar behavior. */
export function createWeaponSwapSkill(
  overrides: Partial<Pick<Skill, 'cooldown' | 'inputCategory' | 'description'>> = {}
) {
  return {
    name: 'Swap Weapons',
    description: 'Swap equipped weapon sets.',
    icon: WEAPON_SWAP_ICON,
    type: 'Action',
    slot: 'Action',
    inputCategory: 'weapon-swap',
    cooldown: 10,
    rechargeIgnoresAlacrity: true,
    rechargeAnchor: 'castStart',
    castTimeMs: 0,
    ...overrides,
    id: SHARED_SKILL_IDS.SWAP_WEAPONS,
    effects: []
  } satisfies Skill;
}

/** Shares the fixed base dodge cost and presentation; professions supply their selected variant. */
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
      | 'tasks'
    >
  > = {}
) {
  return {
    name: 'Dodge',
    description: 'Perform a dodge roll.',
    icon: DODGE_ICON,
    type: 'Action',
    slot: 'Action',
    // The dodge key drives editor shortcuts and input-activity tracing for every profession's dodge.
    inputControl: 'dodge',
    cooldown: 0,
    cost: { resource: 'endurance', amount: ENDURANCE.dodgeCost },
    castTimeMs: 800,
    ...overrides,
    id: SHARED_SKILL_IDS.DODGE,
    effects: []
  } satisfies Skill;
}
