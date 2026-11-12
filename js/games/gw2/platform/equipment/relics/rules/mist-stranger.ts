/** Mist Stranger relic rules. */
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { ACTOR } from '#gw2/platform/constants.js';
import { RELIC_IDS } from '#gw2/platform/equipment/relics/data.js';
import { announceRelic, defineRelic, playerOwnedRelicSource } from '#gw2/platform/equipment/relics/rules/shared.js';
import type { Gw2RelicContext } from '#gw2/platform/equipment/relics/types.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';

export const mistStranger = defineRelic({
  damagePayload: emitDamagePayload,
  damageResolved(ctx, event) {
    // Player-owned strikes such as Apex Predator trigger siphons; conditions and life steal cannot retrigger them.
    const playerStrike =
      isGw2PlayerActorEvent(event) || (event.actorType === ACTOR.EFFECT && event.ownerActorType === ACTOR.PLAYER);

    if (!playerStrike || event.damageKind === 'life-steal' || event.damageKind === 'condition') return;

    emitDamagePayload(ctx, event);
  }
});

/** One occurrence shares its payload with simulation after activation checks have succeeded. */
function emitDamagePayload(ctx: Gw2RelicContext, event: SimulationEvent): void {
  const siphon = 105 * Number(event.hits || 1);
  // Flat life-steal packets bypass strike modifiers while sharing target gates, damage accounting, and causality.
  ctx.effects.emit({
    kind: 'packet',
    cause: event,
    event: {
      type: 'damage',
      at: event.at,
      name: 'Relic of the Mist Stranger',
      skillName: 'Relic of the Mist Stranger',
      triggeredBy: event.skillName,
      coefficient: 0,
      hits: event.hits,
      ...playerOwnedRelicSource(RELIC_IDS.MIST_STRANGER),
      flatDamage: siphon,
      damageKind: 'life-steal',
      canCrit: false
    }
  });
  announceRelic(ctx, event, 'Relic of the Mist Stranger');
}
