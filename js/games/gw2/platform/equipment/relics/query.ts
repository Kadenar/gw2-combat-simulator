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
  return ctx.relic?.queries.strikeMultiplier(ctx, event) ?? 1;
}

/** Returns the selected relic's contribution to the additive damage bucket. */
export function relicOutgoingDamageBonus(ctx: Gw2RelicRuntimeContext, at: number): number {
  return ctx.relic?.queries.outgoingDamageBonus(ctx, at) ?? 0;
}

/** Returns the selected relic's additive critical-strike chance bonus. */
export function relicCriticalChanceBonus(
  ctx: Pick<Gw2RelicRuntimeContext, 'relic'>,
  event: SimulationEvent,
  mightStacks: number
): number {
  return ctx.relic?.queries.criticalChanceBonus(event, mightStacks) ?? 0;
}

/**
 * Returns the selected relic's additive condition-duration bonus.
 */
export function relicConditionDurationBonus(ctx: Gw2RelicDurationQueryContext, at: number): number {
  return ctx.relic?.queries.conditionDurationBonus(ctx, at) ?? 0;
}

/**
 * Returns the selected relic's flat Condition Damage attribute bonus at `at`.
 * Folded into the sampled stats so condition ticks scale with it directly.
 */
export function relicConditionDamageBonus(ctx: Gw2RelicAttributeQueryContext, at: number): number {
  return ctx.relic?.queries.conditionDamageBonus(ctx, at) ?? 0;
}

/** Samples earned concentration before a new boon application claims its own relic stack. */
export function relicConcentrationBonus(ctx: Pick<Gw2RelicRuntimeContext, 'relic'>, at: number): number {
  return ctx.relic?.queries.concentrationBonus(at) ?? 0;
}
