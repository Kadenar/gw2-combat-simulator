import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { isFlatLifeStealPacket } from '#gw2/platform/effects/packet-builders.js';
import { leadAttacksSiphonMultiplier } from '#gw2/professions/thief/core/traits/trickery/resource-queries.js';
import type { ThiefResolverContext, ThiefResolverEvent } from '#gw2/professions/thief/types.js';

/** Apply siphon-specific bonuses at impact because flat life steal bypasses ordinary strike modifiers. */
export function modifyThiefLifeSiphon(context: ThiefResolverContext, event: ThiefResolverEvent) {
  if (!isFlatLifeStealPacket(event) || !isGw2PlayerModifierOwnedEvent(event)) return;
  let multiplier = event.flatStrikeMultiplier ?? 1;
  // Vampiric Slash samples live Vulnerability for its siphon only, independently of the packet's label.
  if (
    event.metadata?.packetKind === 'thief.vampiric-slash-life-siphon' &&
    context.combat.targetHasCondition('Vulnerability', event.at)
  )
    multiplier *= 1.5;

  return { flatStrikeMultiplier: multiplier * leadAttacksSiphonMultiplier(context, event.at) };
}
