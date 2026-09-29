import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { revenantLifeSiphonBonus } from '#gw2/professions/revenant/core/traits/behavior.js';
import type { RevenantResolverContext } from '#gw2/professions/revenant/types.js';

/** Applies Fury's life-steal bonus to Core and elite specializations without using ordinary strike scaling. */
export function modifyRevenantLifeSiphon(context: RevenantResolverContext, event: Gw2ResolverEvent) {
  const bonus = revenantLifeSiphonBonus(context, event);
  if (bonus == null) return;
  return { flatStrikeMultiplier: (event.flatStrikeMultiplier ?? 1) * (1 + bonus) };
}
