/** Mistburn relic rules. */
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { defineRelic } from '#gw2/platform/equipment/relics/rules/shared.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { Gw2RelicState } from '#gw2/platform/equipment/relics/types.js';

/** Both phases claim their own ICD; only actual boon applications produce authoritative grants. */
function mistburnGrant(state: Gw2RelicState, event: SimulationEvent): SimulationEvent | null {
  if (
    event.type !== 'buff' ||
    String(event.kind || '').toLowerCase() !== 'might' ||
    !isGw2PlayerActorEvent(event) ||
    !event.resolvedAudience?.includesSelf ||
    !(Number(event.duration) > 0) ||
    !(Number(event.stacks ?? 1) > 0) ||
    !isInternalCooldownReady(event.at, state.readyAt ?? 0)
  )
    return null;
  state.readyAt = event.at + 1;
  return {
    type: 'buff',
    at: event.at,
    priority: event.priority,
    activationId: event.activationId,
    comboId: event.comboId,
    triggeredBy: event.skillName,
    name: 'Relic of Mistburn - Might',
    skillName: 'Relic of Mistburn',
    kind: 'might',
    duration: 8,
    stacks: 1,
    source: 'Relic',
    sourceId: 'relic.mistburn',
    actorType: 'effect'
  };
}

export const mistburn = defineRelic({
  createState: () => ({ readyAt: 0 }),
  boon(ctx, state, event) {
    const grant = mistburnGrant(state, event);
    if (grant) ctx.queue.enqueue(grant);
    if (event.type !== 'buff' || event.sourceId !== 'relic.mistburn') {
      return;
    }

    ctx.recordProc('relic', 'Relic of Mistburn', event.at, event.triggeredBy || event.skillName);
  },
  criticalChanceBonus(_ctx, _state, event, mightStacks) {
    return isGw2PlayerActorEvent(event) && mightStacks >= 10 ? 0.1 : 0;
  }
});
