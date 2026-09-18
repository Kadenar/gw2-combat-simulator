/** Dragonhunter relic rules. */
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { skillForEvent } from '#gw2/platform/combat/query/event-skill.js';
import { defineRelic, timedStrikeBuff, recordTimedBuffProc } from '#gw2/platform/equipment/relics/rules/shared.js';

export const dragonhunter = defineRelic({
  createState: () => ({ buffUntil: 0 }),
  afterHit(ctx, state, event, skill) {
    if (!isGw2PlayerActorEvent(event) || !skill?.categories?.includes('Trap')) {
      return;
    }

    recordTimedBuffProc(ctx, state, event, {
      duration: 5,
      name: 'Relic of the Dragonhunter'
    });
  },
  conditionDurationBonus(_ctx, state, at) {
    return Number(state.buffUntil || 0) > at ? 0.1 : 0;
  },
  strikeMultiplier(ctx, state, event) {
    // The trap hit benefits from the debuff it applies; afterHit records the window for subsequent attacks.
    const skill = ctx.helpers ? skillForEvent(ctx.helpers, event) : undefined;
    return isGw2PlayerActorEvent(event) && skill?.categories?.includes('Trap')
      ? 1.1
      : timedStrikeBuff(1.1)(ctx, state, event);
  }
});
