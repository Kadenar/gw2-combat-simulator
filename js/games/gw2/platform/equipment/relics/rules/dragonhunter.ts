import { RELIC_IDS } from '#gw2/platform/equipment/relics/data.js';
/** Dragonhunter relic rules. */
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { skillForEvent } from '#gw2/platform/combat/query/runtime-query.js';
import {
  defineRelic,
  relicBuffActive,
  timedStrikeBuff,
  recordTimedBuffProc
} from '#gw2/platform/equipment/relics/rules/shared.js';

export const dragonhunter = defineRelic({
  buffPolicies: [{ kind: 'relic-dragonhunter', name: 'Relic of the Dragonhunter', maximumStacks: 1 }],
  afterHit(ctx, _state, event, skill) {
    if (!isGw2PlayerActorEvent(event) || !skill?.categories?.includes('Trap')) {
      return;
    }

    recordTimedBuffProc(ctx, event, {
      relicId: RELIC_IDS.DRAGONHUNTER,
      kind: 'relic-dragonhunter',
      duration: 5,
      name: 'Relic of the Dragonhunter'
    });
  },
  conditionDurationBonus(ctx, _state, at) {
    return relicBuffActive(ctx, 'relic-dragonhunter', at) ? 0.1 : 0;
  },
  strikeMultiplier(ctx, state, event) {
    // The trap hit benefits from the debuff it applies; afterHit records the window for subsequent attacks.
    const skill = ctx.helpers ? skillForEvent(ctx.helpers, event) : undefined;
    return isGw2PlayerActorEvent(event) && skill?.categories?.includes('Trap')
      ? 1.1
      : timedStrikeBuff('relic-dragonhunter', 1.1)(ctx, state, event);
  }
});
