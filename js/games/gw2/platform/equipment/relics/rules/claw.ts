import { RELIC_IDS } from '#gw2/platform/equipment/relics/data.js';
/** Claw relic rules. */
import { isGw2PlayerActorEvent, isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { defineRelic, timedStrikeBuff, recordTimedBuffProc } from '#gw2/platform/equipment/relics/rules/shared.js';

export const claw = defineRelic({
  buffPolicies: [{ kind: 'relic-claw', maximumStacks: 1 }],
  control(ctx, _state, event) {
    if (!isGw2PlayerActorEvent(event)) return;
    recordTimedBuffProc(ctx, event, {
      relicId: RELIC_IDS.CLAW,
      kind: 'relic-claw',
      // EVTC imports carry the exact remaining opening window without fabricating the CC that created it.
      duration: event.controlKind === 'initial-state' ? Math.max(0, Number(event.initialStateDuration || 0)) : 8,
      name: 'Relic of the Claw'
    });
  },
  // Claw follows outgoing modifier ownership so player-owned effect packets inherit its strike bonus.
  strikeMultiplier: timedStrikeBuff('relic-claw', 1.07, isGw2PlayerModifierOwnedEvent)
});
