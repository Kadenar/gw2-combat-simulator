/** Blightbringer relic rules. */
import { isInternalCooldownReady } from '#gw2/platform/combat/procs/registry.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { CONDITION } from '#gw2/platform/constants.js';
import { RELIC_IDS } from '#gw2/platform/equipment/relics/data.js';
import { announceRelic, defineRelic, playerOwnedRelicSource } from '#gw2/platform/equipment/relics/rules/shared.js';
import type { Gw2RelicContext } from '#gw2/platform/equipment/relics/types.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import { advanceCounter } from '#kernel/resources/counters.js';

// Combat counts distinct poison activations before triggering the payload.
const REQUIRED_ACTIVATIONS = 6;

export const blightbringer = defineRelic({
  damagePayload: emitDamagePayload,
  createState: () => ({
    readyAt: 0,
    count: 0,
    trackedActivations: new Set<string>()
  }),
  condition(ctx, state, application) {
    if (application.condition !== CONDITION.POISONED || !isGw2PlayerActorEvent(application)) {
      return;
    }

    // Deduplicate by activationId (or a synthesized key) so a single skill
    // application that produces multiple poison stacks only increments the
    // Blightbringer counter once.
    const tracked = state.trackedActivations;
    const key = application.activationId || `${application.skillId || application.skillName}:${application.at}`;

    if (tracked?.has(key)) return;

    tracked?.add(key);

    // Poison applied during the payload cooldown cannot build progress toward the next proc.
    if (!isInternalCooldownReady(application.at, state.readyAt)) return;

    const progress = advanceCounter(state.count || 0, 1, REQUIRED_ACTIVATIONS, 'cap');
    state.count = progress.value;

    if (!progress.reached) {
      return;
    }

    state.count = 0;
    state.readyAt = application.at + 8;
    emitDamagePayload(ctx, application);
  }
});

/** One occurrence shares its payload with simulation after activation checks have succeeded. */
function emitDamagePayload(ctx: Gw2RelicContext, application: SimulationEvent): void {
  announceRelic(ctx, application, 'Relic of Blightbringer');
  for (const [condition, stacks, duration] of [
    [CONDITION.POISONED, 3, 10],
    [CONDITION.CRIPPLED, 1, 5],
    [CONDITION.WEAKNESS, 1, 5]
  ] as const) {
    ctx.effects.emit({
      kind: 'packet',
      settlement: 'reaction',
      event: {
        type: 'condition',
        at: application.at,
        name: `Relic of Blightbringer - ${condition}`,
        skillName: 'Relic of Blightbringer',
        condition,
        duration,
        stacks,
        ...playerOwnedRelicSource(RELIC_IDS.BLIGHTBRINGER)
      }
    });
  }
}
