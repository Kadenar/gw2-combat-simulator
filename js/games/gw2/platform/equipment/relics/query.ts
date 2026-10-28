/** Exposes pure timestamped relic contributions to combat queries. */
import type {
  Gw2RelicAttributeQueryContext,
  Gw2RelicDurationQueryContext,
  Gw2RelicRuntimeContext,
  Gw2RelicStrikeQueryContext
} from '#gw2/platform/equipment/relics/types.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';

/**
 * Calculates the strike multiplier supplied by the selected relic.
 */
export function relicStrikeMultiplier(ctx: Gw2RelicStrikeQueryContext, event: SimulationEvent): number {
  // Expiring preparation buffs multiply with the combat relic, without duplicating an equipped relic's buff.
  return (ctx.precastRelics || []).reduce(
    (multiplier, relic) => multiplier * (relic.rules.strikeMultiplier?.(ctx, relic.state, event) ?? 1),
    ctx.relic?.rules.strikeMultiplier?.(ctx, ctx.relic.state, event) ?? 1
  );
}

/** Returns the selected relic's contribution to the additive damage bucket. */
export function relicOutgoingDamageBonus(
  ctx: Gw2RelicRuntimeContext,
  damageType: 'strike' | 'condition',
  at: number,
  event: SimulationEvent | null = null
): number {
  return ctx.relic?.rules.outgoingDamageBonus?.(ctx, ctx.relic.state, damageType, at, event) ?? 0;
}

/** Returns the selected relic's additive critical-strike chance bonus. */
export function relicCriticalChanceBonus(
  ctx: Gw2RelicRuntimeContext,
  event: SimulationEvent,
  mightStacks: number
): number {
  return ctx.relic?.rules.criticalChanceBonus?.(ctx, ctx.relic.state, event, mightStacks) ?? 0;
}

/**
 * Returns the selected relic's additive condition-duration bonus.
 */
export function relicConditionDurationBonus(ctx: Gw2RelicDurationQueryContext, at: number): number {
  return ctx.relic?.rules.conditionDurationBonus?.(ctx, ctx.relic.state, at) ?? 0;
}

/**
 * Returns the selected relic's flat Condition Damage attribute bonus at `at`.
 * Folded into the sampled stats so condition ticks scale with it directly.
 */
export function relicConditionDamageBonus(ctx: Gw2RelicAttributeQueryContext, at: number): number {
  return ctx.relic?.rules.conditionDamageBonus?.(ctx, ctx.relic.state, at) ?? 0;
}
