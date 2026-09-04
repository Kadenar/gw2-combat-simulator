/** Shares live Warrior modifier queries without coupling trait-line fragments to their composer. */
import { GW2_STANDARD_BOONS } from '#gw2/platform/combat/state/boons.js';
import { readProfessionCoreState } from '#gw2/platform/engine/profession/state.js';
import { eventSkill as gw2EventSkill } from '#gw2/platform/combat/query/runtime-query.js';
import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';
import type { SchedulerRecord } from '#gw2/platform/engine/execution/types.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers/types.js';
import type { WarriorCoreState, WarriorSkill } from '#gw2/professions/warrior/types.js';

export type WarriorModifierAttributes = SchedulerRecord & {
  power: number;
  precision: number;
  ferocity: number;
  conditionDamage: number;
  expertise: number;
  vitality: number;
  healingPower: number;
  concentration: number;
};

export function warriorEventSkill(context: Gw2ModifierContext): WarriorSkill | undefined {
  return gw2EventSkill<WarriorSkill>(context);
}

export function warriorTargetControlled(context: Gw2ModifierContext): boolean {
  const state = readProfessionCoreState<WarriorCoreState>(context.runtime?.profession);
  return Boolean(
    context.config?.target?.controlled ||
    context.config?.target?.defiant ||
    Number(state.targetControlledUntil || 0) > context.time
  );
}

// Warrior modifiers historically read configured and live resolver boons only; timeline state must not change them.
export function warriorBoonActive(context: Gw2ModifierContext, boon: string): boolean {
  if (context.config?.boons?.[boon]) return true;
  return (context.runtime?.boons?.get(boon) || []).some(
    (application) =>
      application.resolvedAudience.includesSelf &&
      application.at <= context.time &&
      application.expiresAt > context.time
  );
}

export function warriorActiveBuffStacks(context: Gw2ModifierContext, kind: string, maximum: number): number {
  const stacks = (context.runtime?.boons?.get(kind) || [])
    .filter(
      (application) =>
        application.resolvedAudience.includesSelf &&
        application.at <= context.time &&
        application.expiresAt > context.time
    )
    .reduce((total, application) => total + application.stacks, 0);
  return Math.min(maximum, stacks);
}

export function warriorActiveBoonCount(context: Gw2ModifierContext): number {
  return GW2_STANDARD_BOONS.filter((boon) => warriorBoonActive(context, boon)).length;
}

export function warriorTargetBoonCount(context: Gw2ModifierContext): number {
  const target = context.config?.target;
  if (target?.boonless === true) return 0;
  if (Array.isArray(target?.boons)) return new Set(target.boons.map(String)).size;
  if (target?.boonCount != null) return Math.max(0, Math.trunc(Number(target.boonCount) || 0));
  return target?.boonless === false ? 1 : 0;
}

// Test both weapon hands at query time, including projected modifier-evaluation swaps.
export function warriorWieldingWeapon(context: Gw2ModifierContext, weapon: string): boolean {
  if (warriorEventSkill(context)?.weapon === weapon) return true;
  const weaponSet = Number(context.runtime?.activeWeaponSet) === 2 ? 2 : 1;
  const [primary, secondary] = gw2ConfiguredWeaponSet(context.config, weaponSet);
  return String(primary || '') === weapon || String(secondary || '') === weapon;
}
