import type { SimulationEvent } from '#gw2/platform/events/events.js';
import { RELIC_IDS } from '#gw2/platform/equipment/relics/data.js';
import type { Gw2RelicContext, Gw2RelicState } from '#gw2/platform/equipment/relics/types.js';
/** Steamshrieker relic rules. */
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { defineRelic } from '#gw2/platform/equipment/relics/rules/shared.js';

export const steamshrieker = defineRelic({
  damagePayload: emitDamagePayload,
  combo(ctx, state, event) {
    if (
      !isGw2PlayerActorEvent(event) ||
      event.fieldType !== 'Water' ||
      !['Blast', 'Leap'].includes(String(event.finisherType || ''))
    ) {
      return;
    }

    emitDamagePayload(ctx, state, event);
  }
});

/** One occurrence shares its payload with simulation after activation checks have succeeded. */
function emitDamagePayload(ctx: Gw2RelicContext, _state: Gw2RelicState, event: SimulationEvent): void {
  // Steamshrieker is a shared relic: every profession's successful player-owned water blast or leap burns once.
  ctx.effects.emit({
    kind: 'packet',
    event: {
      type: 'condition',
      at: event.at,
      source: 'Relic',
      sourceId: `relic.${RELIC_IDS.STEAMSHRIEKER}`,
      actorType: 'effect',
      ownerActorType: 'player',
      skillName: 'Relic of Steamshrieker',
      name: 'Relic of Steamshrieker — Burning',
      condition: 'Burning',
      stacks: 1,
      duration: 5,
      triggeredBy: event.skillName
    }
  });
  ctx.effects.emit({
    kind: 'announcement',
    announcement: { type: 'relic', name: 'Relic of Steamshrieker', at: event.at, sourceSkill: event.skillName }
  });
}
