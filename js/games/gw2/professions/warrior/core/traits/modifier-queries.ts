/** Shares live Warrior modifier queries without coupling trait-line fragments to their composer. */
import { activeBuffStacks } from '#gw2/platform/combat/query/runtime-query.js';
import { boonActive, countActiveBoons, eventSkill } from '#gw2/platform/combat/query/runtime-query.js';
import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';
import type { Gw2MutableStats } from '#gw2/platform/combat/types.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';

export type WarriorModifierAttributes = Gw2MutableStats & {
  power: number;
  precision: number;
  ferocity: number;
  conditionDamage: number;
  expertise: number;
  vitality: number;
  healingPower: number;
  concentration: number;
};

// Use canonical duration pools while retaining Warrior's config/live-only visibility contract.
export function warriorBoonActive(context: Gw2ModifierContext, boon: string): boolean {
  return boonActive({ ...context, timeline: undefined }, boon);
}

// Custom Warrior stacks read only live self applications; configured boons never stand in for trait windows.
export function warriorActiveBuffStacks(context: Gw2ModifierContext, kind: string, maximum: number): number {
  return activeBuffStacks({ ...context, timeline: undefined }, kind, maximum);
}

export function warriorActiveBoonCount(context: Gw2ModifierContext): number {
  return countActiveBoons(context, { actor: 'player' }, (boon) => warriorBoonActive(context, boon));
}

// Test both weapon hands at query time, including projected modifier-evaluation swaps.
export function warriorWieldingWeapon(context: Gw2ModifierContext, weapon: string): boolean {
  if (eventSkill(context)?.weapon === weapon) return true;
  const weaponSet = Number(context.runtime?.activeWeaponSet) === 2 ? 2 : 1;
  const [primary, secondary] = gw2ConfiguredWeaponSet(context.config, weaponSet);
  return (primary || '') === weapon || (secondary || '') === weapon;
}
