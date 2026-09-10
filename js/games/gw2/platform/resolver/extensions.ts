import type { SimulationEvent } from '#gw2/platform/engine/events/types.js';
import { createRelicTimelineRuntime } from '#gw2/platform/equipment/relics/runtime.js';
import {
  recordPassiveRelicTimeline,
  relicConditionDurationBonus,
  relicStrikeMultiplier
} from '#gw2/platform/equipment/relics/query.js';
import { createGw2EquipmentReactionContributions } from '#gw2/platform/resolver/equipment-reactions.js';
import { createGw2ResolverReactionRegistry } from '#gw2/platform/resolver/reaction-registry.js';

import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { Gw2QueryRuntime } from '#gw2/platform/combat/query/types.js';
import type { Gw2ResolverExtensions, Gw2ResolverReactions } from '#gw2/platform/resolver/types.js';

/** Composes all resolver-stage and synchronous equipment capabilities once. */
export function createGw2ResolverExtensions({
  config,
  events = [],
  professionReactions = {}
}: {
  readonly config: Gw2Config;
  readonly events?: readonly SimulationEvent[];
  readonly professionReactions?: Gw2ResolverReactions;
}): Readonly<Gw2ResolverExtensions> {
  const reactions = createGw2ResolverReactionRegistry({
    professionReactions,
    contributions: createGw2EquipmentReactionContributions()
  });

  const historicalRelicContext = Object.freeze({
    relic: createRelicTimelineRuntime(config.relic, events)
  });
  const conditionDurationBonus = (context: Gw2QueryRuntime | null | undefined, at: number): number =>
    relicConditionDurationBonus(context?.relic ? context : historicalRelicContext, at);

  return Object.freeze({
    reactions,
    strikeMultiplier: relicStrikeMultiplier,
    conditionDurationBonus,
    beforeResolveTimeline: recordPassiveRelicTimeline
  });
}
