import { recordPassiveRelicTimeline, relicStrikeMultiplier } from '#gw2/platform/equipment/relics/query.js';
import { createGw2EquipmentReactionContributions } from '#gw2/platform/resolver/equipment-reactions.js';
import { createGw2ResolverReactionRegistry } from '#gw2/platform/resolver/reaction-registry.js';

import type { Gw2ResolverExtensions, Gw2ResolverReactions } from '#gw2/platform/resolver/types.js';

/** Composes all resolver-stage and synchronous equipment capabilities once. */
export function createGw2ResolverExtensions({
  professionReactions = {}
}: {
  readonly professionReactions?: Gw2ResolverReactions;
} = {}): Readonly<Gw2ResolverExtensions> {
  const reactions = createGw2ResolverReactionRegistry({
    professionReactions,
    contributions: createGw2EquipmentReactionContributions()
  });

  return Object.freeze({
    reactions,
    strikeMultiplier: relicStrikeMultiplier,
    beforeResolveTimeline: recordPassiveRelicTimeline
  });
}
