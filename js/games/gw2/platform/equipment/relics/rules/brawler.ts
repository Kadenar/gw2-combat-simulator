import { RELIC_IDS } from '#gw2/platform/equipment/relics/data.js';
import { relicIdForName } from '#gw2/platform/equipment/relics/catalog.js';
/** Brawler relic rules. */
import { isInternalCooldownReady } from '#gw2/platform/combat/procs.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import {
  defineRelic,
  recordTimedBuffProc,
  timedStrikeBuff,
  compareTimelineEvents
} from '#gw2/platform/equipment/relics/rules/shared.js';

export const brawler = defineRelic({
  buffPolicies: [{ kind: 'relic-brawler', maximumStacks: 1 }],
  createState: () => ({ readyAt: 0 }),
  boon(ctx, state, event) {
    // Preparation can leave a buff running, but only the equipped relic can trigger again after the marker.
    const marker = state.combatMarker;
    const precombat =
      ctx.combatStartPending === true ||
      (ctx.combatStartTime != null &&
        event.at <= ctx.combatStartTime &&
        (!marker || compareTimelineEvents(event, marker) < 0));
    if (
      precombat
        ? !ctx.config.precastRelics?.some((name) => relicIdForName(name) === RELIC_IDS.BRAWLER)
        : ctx.relic?.id !== RELIC_IDS.BRAWLER
    )
      return;
    const kind = (event.kind || '').toLowerCase();
    // Player ownership is insufficient: the boon must reach the player to activate Brawler.
    if (
      (kind !== 'protection' && kind !== 'resolution') ||
      !isGw2PlayerActorEvent(event) ||
      !event.resolvedAudience?.includesSelf ||
      !(Number(event.duration) > 0) ||
      !((event.stacks ?? 1) > 0) ||
      !isInternalCooldownReady(event.at, state.readyAt)
    ) {
      return;
    }

    state.readyAt = event.at + 8;
    recordTimedBuffProc(ctx, event, {
      relicId: RELIC_IDS.BRAWLER,
      kind: 'relic-brawler',
      duration: 4,
      name: 'Relic of the Brawler'
    });
  },
  strikeMultiplier: timedStrikeBuff('relic-brawler', 1.1)
});
