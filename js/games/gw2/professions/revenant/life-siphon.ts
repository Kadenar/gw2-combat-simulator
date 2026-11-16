/** Compose family life-siphon bonuses once so resolver hooks do not depend on each other's multiplier updates. */
import { isFlatLifeStealPacket } from '#gw2/platform/effects/packet-builders.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { revenantLifeSiphonBonus } from '#gw2/professions/revenant/core/traits/invocation/queries.js';
import { renegadeLifeSiphonBonus } from '#gw2/professions/revenant/specializations/renegade/mechanics/kalla-and-band-together.js';

export function modifyRevenantLifeSiphon(context: RevenantRuntime, event: Gw2ResolverEvent) {
  if (!isFlatLifeStealPacket(event)) return;

  const core = revenantLifeSiphonBonus(context, event);
  const fervor = context.profession.specialization.kind === 'Renegade' ? renegadeLifeSiphonBonus(context) : 0;

  return { flatStrikeMultiplier: (event.flatStrikeMultiplier ?? 1) * (1 + core + fervor) };
}
