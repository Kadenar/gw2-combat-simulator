import { RELIC_IDS } from '#gw2/platform/equipment/relics/data.js';
/** Fractal relic rules. */
import { isInternalCooldownReady } from '#gw2/platform/combat/procs.js';
import { defineRelic } from '#gw2/platform/equipment/relics/rules/shared.js';

export const fractal = defineRelic({
  createState: () => ({ readyAt: 0 }),
  condition(ctx, state, application, { activeConditionStackCount }) {
    if (
      application.condition !== 'Bleeding' ||
      !isInternalCooldownReady(application.at, state.readyAt) ||
      activeConditionStackCount(ctx, 'Bleeding', application.at) - (application.stacks || 0) < 6
    ) {
      return;
    }

    // The condition hook fires with the new stacks already counted, so subtract
    // application.stacks to check for the required six pre-existing stacks.
    // Relic damage stays effect-sourced while explicitly inheriting the player's outgoing modifiers.
    state.readyAt = application.at + 20;
    ctx.effects.emit({
      kind: 'announcement',
      announcement: {
        type: 'relic',
        name: 'Relic of the Fractal',
        at: application.at,
        sourceSkill: application.skillName
      }
    });
    ctx.effects.emit({
      kind: 'packet',
      settlement: 'reaction',
      event: {
        type: 'condition',
        at: application.at,
        name: 'Relic of the Fractal — Burning',
        skillName: 'Relic of the Fractal',
        condition: 'Burning',
        duration: 8,
        stacks: 2,
        source: 'Relic',
        sourceId: `relic.${RELIC_IDS.FRACTAL}`,
        actorType: 'effect',
        ownerActorType: 'player'
      }
    });
    ctx.effects.emit({
      kind: 'packet',
      settlement: 'reaction',
      event: {
        type: 'condition',
        at: application.at,
        name: 'Relic of the Fractal — Torment',
        skillName: 'Relic of the Fractal',
        condition: 'Torment',
        duration: 8,
        stacks: 3,
        source: 'Relic',
        sourceId: `relic.${RELIC_IDS.FRACTAL}`,
        actorType: 'effect',
        ownerActorType: 'player'
      }
    });
  }
});
