import { isFlatLifeStealPacket } from '#gw2/platform/resolver/packets.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { boonActive } from '#gw2/platform/combat/query/runtime-query.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import type { RevenantResolverContext } from '#gw2/professions/revenant/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';

/** Explicit life-steal packets bypass ordinary strike modifiers; labels never decide their Core bonus. */
export function revenantLifeSiphonBonus(context: RevenantResolverContext, event: Gw2ResolverEvent): number | null {
  if (!isFlatLifeStealPacket(event)) return null;
  return hasTrait(context.config, TRAIT.FEROCIOUS_AGGRESSION) &&
    boonActive({ config: context.config, runtime: context, time: event.at, event }, 'fury')
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.FEROCIOUS_AGGRESSION), 'damageIncrease')
    : 0;
}

/** Applies Fury's life-steal bonus to Core and elite specializations without using ordinary strike scaling. */
export function modifyRevenantLifeSiphon(context: RevenantResolverContext, event: Gw2ResolverEvent) {
  const bonus = revenantLifeSiphonBonus(context, event);
  if (bonus == null) return;
  return { flatStrikeMultiplier: Number(event.flatStrikeMultiplier ?? 1) * (1 + bonus) };
}
