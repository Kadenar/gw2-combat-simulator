/** Brawler relic rules. */
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
import { defineRelic, timedStrikeBuff, compareTimelineEvents } from '#gw2/platform/equipment/relics/rules/shared.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';

export const brawler = defineRelic({
  createState: () => ({ readyAt: 0, buffUntil: 0 }),
  boon(ctx, state, event) {
    // Preparation can leave a buff running, but only the equipped relic can trigger again after the marker.
    const marker = state.combatMarker as SimulationEvent | undefined;
    const precombat =
      ctx.combatStartPending === true ||
      (ctx.combatStartTime != null &&
        event.at <= ctx.combatStartTime &&
        (!marker || compareTimelineEvents(event, marker) < 0));
    if (precombat ? !ctx.config?.precastRelics?.includes('Brawler') : ctx.relic?.name !== 'Brawler') return;
    const kind = String(event?.kind || '').toLowerCase();
    // Player ownership is insufficient: the boon must reach the player to activate Brawler.
    if (
      (kind !== 'protection' && kind !== 'resolution') ||
      !isGw2PlayerActorEvent(event) ||
      !event.resolvedAudience?.includesSelf ||
      !(Number(event.duration) > 0) ||
      !(Number(event.stacks ?? 1) > 0) ||
      !isInternalCooldownReady(event.at, state.readyAt)
    ) {
      return;
    }

    state.readyAt = event.at + 8;
    state.buffUntil = gw2EffectExpiresAt(event.at, 4);
    ctx.recordProc(
      'relic',
      'Relic of the Brawler',
      event.at,
      event.skillName,
      'activated',
      '',
      null,
      Number(state.buffUntil)
    );
  },
  strikeMultiplier: timedStrikeBuff(1.1)
});
