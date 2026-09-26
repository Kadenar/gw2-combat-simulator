/** Mirage relic rules. */
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { defineRelic } from '#gw2/platform/equipment/relics/rules/shared.js';

export const mirage = defineRelic({
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
