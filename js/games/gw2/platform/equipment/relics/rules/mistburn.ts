/** Mistburn relic rules. */
import { boonKey } from '#gw2/platform/combat/boons.js';
import { isInternalCooldownReady } from '#gw2/platform/combat/procs/registry.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { ACTOR, BOON } from '#gw2/platform/constants.js';
import { RELIC_IDS } from '#gw2/platform/equipment/relics/data.js';
import { defineRelic } from '#gw2/platform/equipment/relics/rules/shared.js';
import type { Gw2RelicState } from '#gw2/platform/equipment/relics/types.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';

/** Both phases claim their own ICD; only actual boon applications produce authoritative grants. */
function mistburnGrant(state: Gw2RelicState, event: SimulationEvent): SimulationEvent | null {
  if (
    event.type !== 'buff' ||
    (event.kind || '').toLowerCase() !== boonKey(BOON.MIGHT) ||
    !isGw2PlayerActorEvent(event) ||
    !event.resolvedAudience?.includesSelf ||
    !(Number(event.duration) > 0) ||
    !((event.stacks ?? 1) > 0) ||
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
    kind: boonKey(BOON.MIGHT),
    duration: 8,
    stacks: 1,
    source: 'Relic',
    sourceId: `relic.${RELIC_IDS.MISTBURN}`,
    actorType: ACTOR.EFFECT
  };
}

export const mistburn = defineRelic({
  createState: () => ({ readyAt: 0 }),
  boon(ctx, state, event) {
    const grant = mistburnGrant(state, event);

    if (grant) ctx.effects.emit({ kind: 'packet', event: grant });

    if (event.type !== 'buff' || event.sourceId !== `relic.${RELIC_IDS.MISTBURN}`) {
      return;
    }

    ctx.effects.emit({
      kind: 'announcement',
      announcement: {
        type: 'relic',
        name: 'Relic of Mistburn',
        at: event.at,
        sourceSkill: event.triggeredBy || event.skillName
      }
    });
  },
  criticalChanceBonus(_ctx, _state, event, mightStacks) {
    return isGw2PlayerActorEvent(event) && mightStacks >= 10 ? 0.1 : 0;
  }
});
