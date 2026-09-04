/** Exposes pure timestamped relic contributions to combat queries. */
import type { SimulationEvent } from '#gw2/platform/engine/events/types.js';
import type { Gw2RelicContext, Gw2RelicRuntimeContext } from '#gw2/platform/equipment/relics/types.js';
import { invokeRelicHook } from '#gw2/platform/equipment/relics/runtime.js';

/**
 * Calculates the strike multiplier supplied by the selected relic.
 */
export function relicStrikeMultiplier(ctx: Gw2RelicContext, event: SimulationEvent): number {
  return Number(invokeRelicHook(ctx, 'strikeMultiplier', event) ?? 1);
}

/** Returns the selected relic's contribution to the additive damage bucket. */
export function relicOutgoingDamageBonus(
  ctx: Gw2RelicRuntimeContext | null | undefined,
  damageType: 'strike' | 'condition',
  at: number,
  event: SimulationEvent | null = null
): number {
  return Number(invokeRelicHook(ctx, 'outgoingDamageBonus', damageType, at, event) ?? 0);
}

/** Returns the selected relic's additive critical-strike chance bonus. */
export function relicCriticalChanceBonus(
  ctx: Gw2RelicRuntimeContext | null | undefined,
  event: SimulationEvent,
  mightStacks: number
): number {
  return Number(invokeRelicHook(ctx, 'criticalChanceBonus', event, mightStacks) ?? 0);
}

/**
 * Returns the selected relic's additive condition-duration bonus.
 */
export function relicConditionDurationBonus(ctx: Gw2RelicRuntimeContext | null | undefined, at: number): number {
  return Number(invokeRelicHook(ctx, 'conditionDurationBonus', at) ?? 0);
}

/**
 * Returns the selected relic's flat Condition Damage attribute bonus at `at`.
 * Folded into the sampled stats so condition ticks scale with it directly.
 */
export function relicConditionDamageBonus(ctx: Gw2RelicRuntimeContext | null | undefined, at: number): number {
  return Number(invokeRelicHook(ctx, 'conditionDamageBonus', at) ?? 0);
}

/**
 * Records passive proc timelines for relics that do not need resolver state.
 */
export function recordPassiveRelicTimeline(
  ctx: Gw2RelicContext,
  events: readonly SimulationEvent[],
  rotationEndTime: number
): void {
  invokeRelicHook(ctx, 'timeline', events, rotationEndTime);
}
