import { boonActive } from '#gw2/platform/combat/query/runtime-query.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import type { RevenantResolverContext, RevenantResolverEvent } from '#gw2/professions/revenant/types.js';

/** Life steal bypasses ordinary strike modifiers; expose its Core bonus for specialization composition. */
export function revenantLifeSiphonBonus(context: RevenantResolverContext, event: RevenantResolverEvent): number | null {
  const flatStrike = [event.flatDamage, event.flatStrikeBase, event.flatStrikePowerCoeff].some(Number.isFinite);
  if (!flatStrike || (!event.lifeSiphon && !/siphon/i.test(`${event.name || ''} ${event.skillName || ''}`)))
    return null;
  return hasTrait(context.config, TRAIT.FEROCIOUS_AGGRESSION) &&
    boonActive({ config: context.config, runtime: context, time: event.at, event }, 'fury')
    ? 0.1
    : 0;
}

/** Applies Fury's life-steal bonus to Core and elite specializations without using ordinary strike scaling. */
export function modifyRevenantLifeSiphon(context: RevenantResolverContext, event: RevenantResolverEvent) {
  const bonus = revenantLifeSiphonBonus(context, event);
  if (bonus == null) return;
  return { flatStrikeMultiplier: Number(event.flatStrikeMultiplier ?? 1) * (1 + bonus) };
}
