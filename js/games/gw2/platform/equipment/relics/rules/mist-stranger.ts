/** Mist Stranger relic rules. */
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { defineRelic } from '#gw2/platform/equipment/relics/rules/shared.js';

export const mistStranger = defineRelic({
  damageResolved(ctx, _state, event) {
    if (!isGw2PlayerActorEvent(event)) return;
    const siphon = 105 * Number(event.hits || 1);
    ctx.totals.strike += siphon;
    ctx.addBreakdown('Relic of the Mist Stranger', siphon, 'strikeDamage', event.hits);
    ctx.resolved.push({
      type: 'damage',
      at: event.at,
      name: 'Relic of the Mist Stranger',
      skillName: 'Relic of the Mist Stranger',
      triggeredBy: event.skillName,
      coefficient: 0,
      hits: event.hits,
      source: 'Relic',
      damage: siphon
    });
    ctx.recordProc('relic', 'Relic of the Mist Stranger', event.at, event.skillName);
  }
});
