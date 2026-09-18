/** Blightbringer relic rules. */
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { defineRelic } from '#gw2/platform/equipment/relics/rules/shared.js';

export const blightbringer = defineRelic({
  createState: () => ({
    readyAt: 0,
    count: 0,
    trackedActivations: new Set<string>()
  }),
  condition(ctx, state, application, { applyCondition }) {
    if (application?.condition !== 'Poisoned' || !isGw2PlayerActorEvent(application)) {
      return;
    }

    // Deduplicate by activationId (or a synthesized key) so a single skill
    // application that produces multiple poison stacks only increments the
    // Blightbringer counter once.
    const tracked = state.trackedActivations as Set<string> | undefined;
    const key = String(application.activationId || `${application.skillId || application.skillName}:${application.at}`);
    if (tracked?.has(key)) return;
    tracked?.add(key);
    state.count = Math.min(6, Number(state.count || 0) + 1);
    if (Number(state.count) < 6 || !isInternalCooldownReady(application.at, state.readyAt)) {
      return;
    }

    state.count = 0;
    state.readyAt = application.at + 8;
    ctx.recordProc('relic', 'Relic of Blightbringer', application.at, application.skillName);
    for (const [condition, stacks, duration] of [
      ['Poisoned', 3, 10],
      ['Crippled', 1, 5],
      ['Weakness', 1, 5]
    ] as const) {
      applyCondition(ctx, {
        type: 'condition',
        at: application.at,
        name: `Relic of Blightbringer - ${condition}`,
        skillName: 'Relic of Blightbringer',
        condition,
        duration,
        stacks,
        source: 'Relic',
        sourceId: 'relic.blightbringer',
        actorType: 'effect',
        ownerActorType: 'player'
      });
    }
  }
});
