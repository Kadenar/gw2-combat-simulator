/**
 * Owns small calculations shared by Conduit's concept-specific cast handlers.
 * State transitions remain in the execution module for the owning skill family.
 */
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { gw2PrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';
import {
  conditionEffectTicks,
  effectFirstAtMs,
  strikeEffectCoefficient
} from '#gw2/platform/engine/effects/timelines.js';
import type { SkillEffect } from '#gw2/platform/engine/types.js';
import type { RevenantCastContext, RevenantSchedulerContext, RevenantSkill } from '#gw2/professions/revenant/types.js';

export function conduitHasLegend(context: RevenantSchedulerContext, legendId: string): boolean {
  return professionCoreState(context).selectedLegendIds.includes(legendId);
}

export function conduitEffectAt(context: RevenantCastContext, effect: SkillEffect | undefined, atMs?: number): number {
  const origin = effect?.timingAnchor === 'castEnd' ? context.fullEnd : context.start;
  const packetAtMs =
    atMs ?? (effect?.type === 'strike' || effect?.type === 'condition' ? effectFirstAtMs(effect) : effect?.atMs);
  return origin + Math.max(0, Number(packetAtMs || 0)) / 1000;
}

export function conduitStrikeCoefficient(effect: SkillEffect | undefined): number {
  return effect?.type === 'strike' ? strikeEffectCoefficient(effect) : 0;
}

export function conduitFirstConditionTick(effect: SkillEffect | undefined, condition?: string) {
  if (effect?.type !== 'condition') return undefined;
  return conditionEffectTicks(effect).find((tick) => condition == null || tick.condition === condition);
}

// Profession attacks inherit the active weapon; slot and triggered attacks use
// standard level-based strength unless their skill declares a weapon directly.
export function conduitSkillWeapon(context: RevenantSchedulerContext, skill: RevenantSkill): string | undefined {
  // activeWeaponSet is 1-indexed; value 2 means the swap weapon set is currently active.
  const weaponSet = Number(context.state.activeWeaponSet) === 2 ? 2 : 1;
  return skill.weapon || (skill.type === 'Profession' ? gw2PrimaryWeapon(context.config, weaponSet) : 'Unequipped');
}
