import { BOON } from '#gw2/platform/constants.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { boonActive } from '#gw2/platform/combat/query/runtime-query.js';
import { isFlatLifeStealPacket } from '#gw2/platform/effects/packet-builders.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { balanceNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import type { RevenantResolverContext } from '#gw2/professions/revenant/types.js';

/** Explicit life-steal packets bypass ordinary strike modifiers; labels never decide their Core bonus. */
export function revenantLifeSiphonBonus(context: RevenantResolverContext, event: Gw2ResolverEvent): number | null {
  if (!isFlatLifeStealPacket(event)) return null;

  return hasTrait(context.traits, TRAIT.FEROCIOUS_AGGRESSION) &&
    boonActive({ config: context.config, runtime: context, time: event.at, event }, boonKey(BOON.FURY))
    ? balanceNumberFromContext(context, TRAIT.FEROCIOUS_AGGRESSION, 'damageIncrease')
    : 0;
}
