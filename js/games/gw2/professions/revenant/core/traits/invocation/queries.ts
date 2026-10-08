import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { boonActive } from '#gw2/platform/combat/query/runtime-query.js';
import { isFlatLifeStealPacket } from '#gw2/platform/effects/packet-builders.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import type { RevenantResolverContext } from '#gw2/professions/revenant/types.js';

/** Explicit life-steal packets bypass ordinary strike modifiers; labels never decide their Core bonus. */
export function revenantLifeSiphonBonus(context: RevenantResolverContext, event: Gw2ResolverEvent): number | null {
  if (!isFlatLifeStealPacket(event)) return null;
  return hasTrait(context.traits, TRAIT.FEROCIOUS_AGGRESSION) &&
    boonActive({ config: context.config, runtime: context, time: event.at, event }, 'fury')
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.FEROCIOUS_AGGRESSION), 'damageIncrease')
    : 0;
}

export function modifyCoreCriticalChance(context: Gw2ModifierContext, chance: number): number {
  return hasTrait(context, TRAIT.ROILING_MISTS) && boonActive(context, 'fury')
    ? chance + balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.ROILING_MISTS), 'criticalChance')
    : chance;
}
