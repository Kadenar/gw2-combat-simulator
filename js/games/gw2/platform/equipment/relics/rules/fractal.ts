/** Fractal relic rules. */
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { defineRelic } from '#gw2/platform/equipment/relics/rules/shared.js';

export const fractal = defineRelic({
  createState: () => ({ readyAt: 0 }),
  condition(ctx, state, application, { activeConditionStackCount, applyCondition }) {
    if (
      application?.condition !== 'Bleeding' ||
      !isInternalCooldownReady(application.at, state.readyAt) ||
      activeConditionStackCount(ctx, 'Bleeding', application.at) - Number(application.stacks || 0) < 6
    ) {
      return;
    }

    // The condition hook fires with the new stacks already counted, so subtract
    // application.stacks to check for the required six pre-existing stacks.
    // Relic damage stays effect-sourced while explicitly inheriting the player's outgoing modifiers.
    state.readyAt = application.at + 20;
    ctx.recordProc('relic', 'Relic of the Fractal', application.at, application.skillName);
    applyCondition(ctx, {
      type: 'condition',
      at: application.at,
      name: 'Relic of the Fractal — Burning',
      skillName: 'Relic of the Fractal',
      condition: 'Burning',
      duration: 8,
      stacks: 2,
      source: 'Relic',
      sourceId: 'relic.fractal',
      actorType: 'effect',
      ownerActorType: 'player'
    });
    applyCondition(ctx, {
      type: 'condition',
      at: application.at,
      name: 'Relic of the Fractal — Torment',
      skillName: 'Relic of the Fractal',
      condition: 'Torment',
      duration: 8,
      stacks: 3,
      source: 'Relic',
      sourceId: 'relic.fractal',
      actorType: 'effect',
      ownerActorType: 'player'
    });
  }
});
