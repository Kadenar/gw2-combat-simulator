import { RELIC_IDS } from '#gw2/platform/equipment/relics/data.js';
/** Akeem relic rules. */
import { isInternalCooldownReady } from '#gw2/platform/combat/procs.js';
import { defineRelic } from '#gw2/platform/equipment/relics/rules/shared.js';

export const akeem = defineRelic({
  createState: () => ({ readyAt: 0 }),
  control(ctx, state, event, { activeConditionStackCount }) {
    if (!isInternalCooldownReady(event.at, state.readyAt)) return;
    if (
      activeConditionStackCount(ctx, 'Confusion', event.at) < 5 &&
      activeConditionStackCount(ctx, 'Torment', event.at) < 5
    ) {
      return;
    }

    state.readyAt = event.at + 10;
    ctx.effects.emit({
      kind: 'announcement',
      announcement: { type: 'relic', name: 'Relic of Akeem', at: event.at, sourceSkill: event.skillName }
    });
    // Relic conditions carry their own actor identity instead of relying on source-label inference.
    ctx.effects.emit({
      kind: 'packet',
      settlement: 'reaction',
      event: {
        type: 'condition',
        at: event.at,
        name: 'Relic of Akeem — Confusion',
        skillName: 'Relic of Akeem',
        condition: 'Confusion',
        duration: 10,
        stacks: 2,
        source: 'Relic',
        sourceId: RELIC_IDS.AKEEM,
        actorType: 'effect'
      }
    });
    ctx.effects.emit({
      kind: 'packet',
      settlement: 'reaction',
      event: {
        type: 'condition',
        at: event.at,
        name: 'Relic of Akeem — Torment',
        skillName: 'Relic of Akeem',
        condition: 'Torment',
        duration: 10,
        stacks: 2,
        source: 'Relic',
        sourceId: RELIC_IDS.AKEEM,
        actorType: 'effect'
      }
    });
  }
});
