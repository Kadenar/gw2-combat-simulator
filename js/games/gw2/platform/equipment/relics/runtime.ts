/** Creates and invokes the selected relic's runtime. Per-relic behavior lives in `rules/`. */
import { RELIC_RULES } from '#gw2/platform/equipment/relics/rules/index.js';

import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type {
  Gw2RelicRule,
  Gw2RelicRuntime,
  Gw2RelicRuntimeContext,
  Gw2RelicState
} from '#gw2/platform/equipment/relics/types.js';

const STATELESS_RELIC: Readonly<Gw2RelicRule> = Object.freeze({});

/**
 * Creates the selected relic runtime. Rules are immutable and shared; mutable
 * state is created independently for each simulation.
 */
export function createRelicRuntime(name: unknown): Readonly<Gw2RelicRuntime> {
  const selectedName = String(name || '');
  const rules = RELIC_RULES[selectedName] || STATELESS_RELIC;
  const state = rules.createState?.() || {};
  return Object.freeze({
    name: selectedName,
    rules,
    state
  });
}

// Sets timelineLength to -1 (not events.length) so a replaying rule — see
// syncAristocracyTimeline in rules/aristocracy.ts — treats the state as dirty
// and replays on the first call even when the events array is empty.
/** Creates relic runtime state prepared to replay chronological timeline events. */
export function createRelicTimelineRuntime(
  name: unknown,
  events: readonly SimulationEvent[]
): Readonly<Gw2RelicRuntime> {
  const runtime = createRelicRuntime(name);
  runtime.state.timelineEvents = events;
  runtime.state.timelineLength = -1;
  return runtime;
}

export function invokeRelicHook(
  ctx: Gw2RelicRuntimeContext | null | undefined,
  hook: keyof Gw2RelicRule,
  ...args: unknown[]
): unknown {
  const relic = ctx?.relic;
  if (!ctx || !relic) return undefined;
  const handler = relic.rules[hook];
  if (typeof handler !== 'function') return undefined;
  const dynamicHandler = handler as unknown as (
    context: unknown,
    state: Gw2RelicState,
    ...values: unknown[]
  ) => unknown;
  return dynamicHandler(ctx, relic.state, ...args);
}
