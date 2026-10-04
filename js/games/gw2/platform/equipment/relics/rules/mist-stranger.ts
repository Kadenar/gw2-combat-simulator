import type { SimulationEvent } from '#gw2/platform/events/events.js';
import { RELIC_IDS } from '#gw2/platform/equipment/relics/data.js';
import type { Gw2RelicContext, Gw2RelicState } from '#gw2/platform/equipment/relics/types.js';
/** Mist Stranger relic rules. */
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { defineRelic } from '#gw2/platform/equipment/relics/rules/shared.js';

export const mistStranger = defineRelic({
  damagePayload: emitDamagePayload,
  damageResolved(ctx, state, event) {
    if (!isGw2PlayerActorEvent(event)) return;
    emitDamagePayload(ctx, state, event);
  }
});

/** One occurrence shares its payload with simulation after activation checks have succeeded. */
function emitDamagePayload(ctx: Gw2RelicContext, _state: Gw2RelicState, event: SimulationEvent): void {
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
      source: 'Relic',
      sourceId: RELIC_IDS.MIST_STRANGER,
      actorType: 'effect',
      ownerActorType: 'player',
      flatDamage: siphon,
      damageKind: 'life-steal',
      canCrit: false
    }
  });
  ctx.effects.emit({
    kind: 'announcement',
    announcement: { type: 'relic', name: 'Relic of the Mist Stranger', at: event.at, sourceSkill: event.skillName }
  });
}
