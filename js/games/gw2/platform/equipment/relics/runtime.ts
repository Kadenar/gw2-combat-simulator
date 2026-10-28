/** Creates the selected relic's runtime. Per-relic behavior lives in `rules/`. */
import { relicIdForName } from '#gw2/platform/equipment/relics/catalog.js';
import { RELIC_RULES } from '#gw2/platform/equipment/relics/rules/index.js';
import type { Gw2RelicRule, Gw2RelicRuntime } from '#gw2/platform/equipment/relics/types.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';

const STATELESS_RELIC: Readonly<Gw2RelicRule> = Object.freeze({});

/**
 * Creates the selected relic runtime. Rules are immutable and shared; mutable
 * state is created independently for each simulation.
 */
export function createRelicRuntime(name: unknown): Readonly<Gw2RelicRuntime> {
  const id = relicIdForName(name);
  const rules = (id == null ? undefined : RELIC_RULES[id]) || STATELESS_RELIC;
  const state = rules.createState?.() || {};
  return Object.freeze({
    id,
    rules,
    state
  });
}

/** Supplies timeline facts for time-based rules such as Nourys's combat-start-relative damage window. */
export function createRelicTimelineRuntime(
  name: unknown,
  events: readonly SimulationEvent[]
): Readonly<Gw2RelicRuntime> {
  const runtime = createRelicRuntime(name);
  runtime.state.timelineEvents = events;
  return runtime;
}
