/** Claw relic rules. */
import { isGw2PlayerActorEvent, isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { RELIC_IDS } from '#gw2/platform/equipment/relics/data.js';
import { defineRelic, recordTimedBuffProc, timedStrikeBuff } from '#gw2/platform/equipment/relics/rules/shared.js';

export const claw = defineRelic({
  buffPolicies: [{ kind: 'relic-claw', name: 'Relic of the Claw', maximumStacks: 1 }],
  control(ctx, _state, event) {
    if (!isGw2PlayerActorEvent(event)) return;

    recordTimedBuffProc(ctx, event, {
      relicId: RELIC_IDS.CLAW,
      kind: 'relic-claw',
      duration: 8,
      name: 'Relic of the Claw'
    });
  },
  // Ritualist spirit autoattacks inherit Claw's bonus; other attacks follow their existing modifier ownership.
  strikeMultiplier: timedStrikeBuff(
    'relic-claw',
    1.07,
    (event) =>
      isGw2PlayerModifierOwnedEvent(event) ||
      (event.summonKind === 'spirit' && event.metadata?.spiritAttackType === 'autoattack')
  )
});
