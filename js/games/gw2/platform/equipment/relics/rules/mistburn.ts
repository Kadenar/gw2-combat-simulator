/** Mistburn relic rules. */
import { isInternalCooldownReady } from '#gw2/platform/combat/procs/registry.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { BOON } from '#gw2/platform/constants.js';
import type { ProfileEmission } from '#gw2/platform/effects/emission.js';
import { RELIC_IDS } from '#gw2/platform/equipment/relics/data.js';
import { announceRelic, defineRelic, relicSource } from '#gw2/platform/equipment/relics/rules/shared.js';
import type { Gw2RelicState } from '#gw2/platform/equipment/relics/types.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';

/** Both phases claim their own ICD; only actual boon applications produce authoritative grants. */
function mistburnGrant(state: Gw2RelicState, event: SimulationEvent): ProfileEmission | null {
  if (
    event.type !== 'buff' ||
    event.kind !== BOON.MIGHT ||
    !isGw2PlayerActorEvent(event) ||
    !event.resolvedAudience?.includesSelf ||
    !(Number(event.duration) > 0) ||
    !((event.stacks ?? 1) > 0) ||
    !isInternalCooldownReady(event.at, state.readyAt ?? 0)
  )
    return null;

  state.readyAt = event.at + 1;
  // The extra Might is a new relic yield, independent of the player grant that triggered it.
  return {
    kind: 'profile',
    profile: { id: `relic.${RELIC_IDS.MISTBURN}`, name: 'Relic of Mistburn' },
    at: event.at,
    attribution: {
      activationId: event.activationId,
      triggeredBy: event.skillName,
      skillName: 'Relic of Mistburn',
      ...relicSource(RELIC_IDS.MISTBURN)
    },
    effects: [{ type: 'boon', boon: BOON.MIGHT, duration: 8, stacks: 1 }],
    transform: (packet) => ({
      ...packet,
      priority: event.priority,
      comboId: event.comboId,
      name: 'Relic of Mistburn - Might'
    })
  };
}

export const mistburn = defineRelic({
  createState: () => ({ readyAt: 0 }),
  boon(ctx, state, event) {
    const grant = mistburnGrant(state, event);

    if (grant) ctx.effects.emit(grant);

    if (event.type !== 'buff' || event.sourceId !== `relic.${RELIC_IDS.MISTBURN}`) {
      return;
    }

    announceRelic(ctx, event, 'Relic of Mistburn', { sourceSkill: event.triggeredBy || event.skillName });
  },
  criticalChanceBonus(_ctx, _state, event, mightStacks) {
    return isGw2PlayerActorEvent(event) && mightStacks >= 10 ? 0.1 : 0;
  }
});
