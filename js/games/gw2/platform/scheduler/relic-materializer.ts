/** Materializes relic-created boon and condition events while the scheduler still owns event production. */
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import { isStandardBoon } from '#gw2/platform/combat/boons.js';
import type { Gw2RelicMaterializerContext, Gw2RelicRuntime } from '#gw2/platform/equipment/relics/types.js';

/** Materializes boon applications created by the selected relic. */
export function materializeBoonRelics(
  ctx: Gw2RelicMaterializerContext,
  relic: Gw2RelicRuntime,
  event: SimulationEvent
): void {
  if (!isStandardBoon(event.kind || event.boon)) return;
  const handler = relic.rules.materializeBoon;
  if (typeof handler !== 'function') return;
  handler(ctx, relic.state, event);
}

/** Materializes condition-triggered effects created by the selected relic. */
export function materializeConditionRelics(
  ctx: Gw2RelicMaterializerContext,
  relic: Gw2RelicRuntime,
  event: SimulationEvent
): void {
  const handler = relic.rules.materializeCondition;
  if (typeof handler !== 'function') return;
  handler(ctx, relic.state, event);
}
