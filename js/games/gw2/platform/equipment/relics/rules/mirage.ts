/** Mirage relic rules. */
import { EPSILON, isInternalCooldownReady } from '#kernel/core/clock.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { defineRelic } from '#gw2/platform/equipment/relics/rules/shared.js';

export const mirage = defineRelic({
  timeline(ctx, _state, events, rotationEndTime) {
    // Each dodge or evade skill assumes a successful evade. Replay action starts
    // so multi-hit attacks and landing packets cannot double-trigger the 1s ICD.
    const dodges = events
      .filter(
        (event) =>
          event.type === 'action' &&
          isGw2PlayerActorEvent(event) &&
          !event.cancelled &&
          (event.evades === true ||
            ['Dodge', 'Dodge / Mirage Cloak', 'Dodge Jump'].includes(String(event.skillName))) &&
          event.at >= (ctx.combatStartTime ?? 0) &&
          event.at <= rotationEndTime + EPSILON
      )
      .sort((a, b) => a.at - b.at);
    for (const dodge of dodges) mirage.action?.(ctx, _state, dodge);
  },
  createState: () => ({ readyAt: -Infinity }),
  action(ctx, state, dodge) {
    // A successful player evade claims the same ICD once, at its actual activation.
    if (
      !isGw2PlayerActorEvent(dodge) ||
      dodge.cancelled ||
      dodge.at < (ctx.combatStartTime ?? 0) ||
      !(dodge.evades === true || ['Dodge', 'Dodge / Mirage Cloak', 'Dodge Jump'].includes(String(dodge.skillName))) ||
      !isInternalCooldownReady(dodge.at, state.readyAt)
    )
      return;
    state.readyAt = dodge.at + 1;
    ctx.queue.enqueue({
      type: 'condition',
      at: dodge.at,
      source: 'Relic',
      sourceId: 'relic.mirage',
      actorType: 'effect',
      ownerActorType: 'player',
      triggeredBy: dodge.skillName,
      skillName: 'Relic of the Mirage',
      name: 'Relic of the Mirage ? Torment',
      condition: 'Torment',
      stacks: 2,
      duration: 6
    });
  },
  condition(ctx, _state, application) {
    if (application.sourceId === 'relic.mirage') {
      ctx.recordProc('relic', 'Relic of the Mirage', application.at, application.triggeredBy, '2 Torment for 6s');
    }
  }
});
