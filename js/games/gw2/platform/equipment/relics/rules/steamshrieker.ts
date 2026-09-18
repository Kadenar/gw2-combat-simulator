/** Steamshrieker relic rules. */
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { defineRelic } from '#gw2/platform/equipment/relics/rules/shared.js';

export const steamshrieker = defineRelic({
  combo(ctx, _state, event) {
    if (
      !isGw2PlayerActorEvent(event) ||
      event.fieldType !== 'Water' ||
      !['Blast', 'Leap'].includes(String(event.finisherType || ''))
    ) {
      return;
    }

    // Steamshrieker is a shared relic: every profession's successful player-owned water blast or leap burns once.
    ctx.queue.enqueue({
      type: 'condition',
      at: event.at,
      source: 'Relic',
      sourceId: 'relic.steamshrieker',
      actorType: 'effect',
      ownerActorType: 'player',
      skillName: 'Relic of Steamshrieker',
      name: 'Relic of Steamshrieker — Burning',
      condition: 'Burning',
      stacks: 1,
      duration: 5,
      triggeredBy: event.skillName
    });
    ctx.recordProc('relic', 'Relic of Steamshrieker', event.at, event.skillName);
  }
});
