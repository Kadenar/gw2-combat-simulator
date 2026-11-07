/** Steamshrieker relic rules. */
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { ACTOR, COMBO_FIELD, COMBO_FINISHER, CONDITION } from '#gw2/platform/constants.js';
import { RELIC_IDS } from '#gw2/platform/equipment/relics/data.js';
import { announceRelic, defineRelic, playerOwnedRelicSource } from '#gw2/platform/equipment/relics/rules/shared.js';
import type { Gw2RelicContext, Gw2RelicState } from '#gw2/platform/equipment/relics/types.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';

export const steamshrieker = defineRelic({
  damagePayload: emitDamagePayload,
  combo(ctx, state, event) {
    // Player-owned trait effects such as Orbital Command Strike can finish water combos independently of weapon hits.
    const playerFinisher =
      isGw2PlayerActorEvent(event) || (event.actorType === ACTOR.EFFECT && event.ownerActorType === ACTOR.PLAYER);

    if (
      !playerFinisher ||
      event.fieldType !== COMBO_FIELD.WATER ||
      ![COMBO_FINISHER.BLAST, COMBO_FINISHER.LEAP].some((finisher) => finisher === event.finisherType)
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
      ...playerOwnedRelicSource(RELIC_IDS.STEAMSHRIEKER),
      skillName: 'Relic of Steamshrieker',
      name: 'Relic of Steamshrieker - Burning',
      condition: CONDITION.BURNING,
      stacks: 1,
      duration: 5,
      triggeredBy: event.skillName
    }
  });
  // Multiple successful combos from one finisher each own a proc, even when they resolve simultaneously.
  announceRelic(ctx, event, 'Relic of Steamshrieker', {
    occurrenceId: typeof event.comboId === 'string' ? event.comboId : undefined
  });
}
