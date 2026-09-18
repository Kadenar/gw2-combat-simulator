/** Claw relic rules. */
import { isGw2PlayerActorEvent, isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { defineRelic, timedStrikeBuff, recordTimedBuffProc } from '#gw2/platform/equipment/relics/rules/shared.js';

export const claw = defineRelic({
  createState: () => ({ buffUntil: 0 }),
  control(ctx, state, event) {
    if (!isGw2PlayerActorEvent(event)) return;
    recordTimedBuffProc(ctx, state, event, {
      // EVTC imports carry the exact remaining opening window without fabricating the CC that created it.
      duration: event.controlKind === 'initial-state' ? Math.max(0, Number(event.initialStateDuration || 0)) : 8,
      name: 'Relic of the Claw'
    });
  },
  // Claw follows outgoing modifier ownership so player-owned effect packets inherit its strike bonus.
  strikeMultiplier: timedStrikeBuff(1.07, isGw2PlayerModifierOwnedEvent)
});
