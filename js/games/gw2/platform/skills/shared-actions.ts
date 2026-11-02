import { ENDURANCE } from '#gw2/platform/combat/resources/endurance-rules.js';
import type { Skill } from '#gw2/platform/skills/types.js';

// Share URL identities in headless catalogs as well as browser bundles.
export const DODGE_ICON = new URL('@images/wiki/dodge.png', import.meta.url).href;

export const WEAPON_SWAP_ICON = new URL('@images/wiki/weapon-swap-button.png', import.meta.url).href;

/** Explicit artwork for synthetic effects without their own game icon; skills opt in at their declaration. */
export const SKILL_PLACEHOLDER_ICON =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="8" fill="#292933"/><text x="32" y="42" text-anchor="middle" fill="#d8d8e0" font-size="32">?</text></svg>'
  );

/** Synthetic identities stay shared across catalogs and saved rotations. */
export const SHARED_SKILL_IDS = Object.freeze({ SWAP_WEAPONS: -3, DODGE: -5 });

/** Declares the common swap action while retaining profession-owned recharge and bar behavior. */
export function createWeaponSwapSkill(overrides: Partial<Pick<Skill, 'cooldown' | 'inputCategory'>> = {}) {
  return {
    name: 'Swap Weapons',
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
      | 'cost'
      | 'castTimeMs'
      | 'interruptCommitMs'
      | 'retainsCastLockoutAfterInterrupt'
      | 'rechargeAnchor'
      | 'specialization'
      | 'skillFamily'
      | 'tasks'
    >
  > = {}
) {
  return {
    name: 'Dodge',
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
