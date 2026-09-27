/** Completed player cantrips refresh the relic's strike bonus regardless of profession. */
import { isGw2PlayerActorEvent, isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { skillForEvent } from '#gw2/platform/combat/query/event-skill.js';
import { defineRelic, recordTimedBuffProc, timedStrikeBuff } from '#gw2/platform/equipment/relics/rules/shared.js';

export const deadeye = defineRelic({
  createState: () => ({ buffUntil: 0 }),
  completed(ctx, state, event) {
    if (event.cancelled || !isGw2PlayerActorEvent(event)) return;
    const skill = ctx.helpers ? skillForEvent(ctx.helpers, event) : undefined;
    if (!skill?.categories?.includes('Cantrip')) return;
    recordTimedBuffProc(ctx, state, event, { duration: 8, name: 'Relic of the Deadeye' });
  },
  strikeMultiplier: timedStrikeBuff(1.1, isGw2PlayerModifierOwnedEvent)
});
