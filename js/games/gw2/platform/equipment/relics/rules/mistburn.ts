/** Mistburn relic rules. */
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { defineRelic } from '#gw2/platform/equipment/relics/rules/shared.js';

export const mistburn = defineRelic({
  createState: () => ({ readyAt: 0 }),
  materializeBoon(ctx, state, event) {
    const kind = String(event.kind || '').toLowerCase();
    if (
      kind !== 'might' ||
      !isGw2PlayerActorEvent(event) ||
      !event.resolvedAudience?.includesSelf ||
      !(Number(event.duration) > 0) ||
      !(Number(event.stacks ?? 1) > 0) ||
      !isInternalCooldownReady(event.at, state.readyAt)
    ) {
      return;
    }

    state.readyAt = event.at + 1;
    ctx.emitDerived(event, {
      type: 'buff',
      at: event.at,
      name: 'Relic of Mistburn - Might',
      skillName: 'Relic of Mistburn',
      kind: 'might',
      duration: 8,
      stacks: 1,
      source: 'Relic',
      sourceId: 'relic.mistburn',
      actorType: 'effect'
    });
  },
  boon(ctx, _state, event) {
    if (event.type !== 'buff' || event.sourceId !== 'relic.mistburn') {
      return;
    }

    ctx.recordProc('relic', 'Relic of Mistburn', event.at, event.triggeredBy || event.skillName);
  },
  criticalChanceBonus(_ctx, _state, event, mightStacks) {
    return isGw2PlayerActorEvent(event) && mightStacks >= 10 ? 0.1 : 0;
  }
});
