import { RELIC_IDS } from '#gw2/platform/equipment/relics/data.js';
/** Completed player cantrips refresh the relic's strike bonus regardless of profession. */
import { isGw2PlayerActorEvent, isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { skillForEvent } from '#gw2/platform/combat/query/event-skill.js';
import { defineRelic, recordTimedBuffProc, timedStrikeBuff } from '#gw2/platform/equipment/relics/rules/shared.js';

export const deadeye = defineRelic({
  buffPolicies: [{ kind: 'relic-deadeye', maximumStacks: 1 }],
  completed(ctx, _state, event) {
    if (event.cancelled || !isGw2PlayerActorEvent(event)) return;
    const skill = ctx.helpers ? skillForEvent(ctx.helpers, event) : undefined;
    if (!skill?.categories?.includes('Cantrip')) return;
    recordTimedBuffProc(ctx, event, {
      relicId: RELIC_IDS.DEADEYE,
      kind: 'relic-deadeye',
      duration: 8,
      name: 'Relic of the Deadeye'
    });
  },
  strikeMultiplier: timedStrikeBuff('relic-deadeye', 1.1, isGw2PlayerModifierOwnedEvent)
});
