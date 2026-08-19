import type { SimulationEvent } from '../../engine/types.js';
import {
  createRelicRuntime,
  createRelicTimelineRuntime,
  recordPassiveRelicTimeline,
  relicConditionDurationBonus,
  relicStrikeMultiplier
} from '../relic-rules.js';
import { createGw2EquipmentReactionContributions } from './equipment-reactions.js';
import { createGw2ResolverReactionRegistry } from './reaction-registry.js';

import type {
  Gw2Config,
  Gw2QueryRuntime,
  Gw2ResolverExtensions,
  Gw2ResolverReactionRegistry,
  Gw2ResolverReactions
} from '../types.js';

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
  let reactions: Readonly<Gw2ResolverReactionRegistry> | null = null;
  const dispatch: Gw2ResolverReactionRegistry['dispatch'] = (stage, context, event, details) => {
    if (!reactions) {
      throw new TypeError('GW2 resolver reactions dispatched during construction.');
    }

    return reactions.dispatch(stage, context, event, details);
  };

  reactions = createGw2ResolverReactionRegistry({
    professionReactions,
    contributions: createGw2EquipmentReactionContributions({ dispatch })
  });

  const historicalRelicContext = Object.freeze({
    relic: createRelicTimelineRuntime(config.relic, events)
  });
  const conditionDurationBonus = (context: Gw2QueryRuntime | null | undefined, at: number): number =>
    relicConditionDurationBonus(context?.relic ? context : historicalRelicContext, at);

  return Object.freeze({
    reactions,
    createEquipmentState(currentConfig: Gw2Config) {
      return {
        relic: createRelicRuntime(currentConfig.relic),
        sigil: {
          severanceUntil: 0,
          criticalProgress: 0,
          readyAt: new Map()
        },
        food: { criticalProgress: 0, readyAt: 0 }
      };
    },
    strikeMultiplier: relicStrikeMultiplier,
    conditionDurationBonus,
    beforeResolveTimeline: recordPassiveRelicTimeline
  });
}
