/** Akeem relic rules. */
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { defineRelic } from '#gw2/platform/equipment/relics/rules/shared.js';

export const akeem = defineRelic({
  createState: () => ({ readyAt: 0 }),
  control(ctx, state, event, { activeConditionStackCount, applyCondition }) {
    if (!isInternalCooldownReady(event.at, state.readyAt)) return;
    if (
      activeConditionStackCount(ctx, 'Confusion', event.at) < 5 &&
      activeConditionStackCount(ctx, 'Torment', event.at) < 5
    ) {
      return;
    }

    state.readyAt = event.at + 10;
    ctx.recordProc('relic', 'Relic of Akeem', event.at, event.skillName);
    // Relic conditions carry their own actor identity instead of relying on source-label inference.
    applyCondition(ctx, {
      type: 'condition',
      at: event.at,
      name: 'Relic of Akeem — Confusion',
      skillName: 'Relic of Akeem',
      condition: 'Confusion',
      duration: 10,
      stacks: 2,
      source: 'Relic',
      actorType: 'effect'
    });
    applyCondition(ctx, {
      type: 'condition',
      at: event.at,
      name: 'Relic of Akeem — Torment',
      skillName: 'Relic of Akeem',
      condition: 'Torment',
      duration: 10,
      stacks: 2,
      source: 'Relic',
      actorType: 'effect'
    });
  }
});
