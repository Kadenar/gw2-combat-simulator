import type { SimulationEvent } from '#gw2/platform/events/events.js';
import { RELIC_IDS } from '#gw2/platform/equipment/relics/data.js';
import type { Gw2RelicContext, Gw2RelicState } from '#gw2/platform/equipment/relics/types.js';
/** Akeem relic rules. */
import { isInternalCooldownReady } from '#gw2/platform/combat/procs/registry.js';
import { defineRelic } from '#gw2/platform/equipment/relics/rules/shared.js';

// Combat activation checks this condition threshold.
const REQUIRED_CONDITIONS = 5;

export const akeem = defineRelic({
  damagePayload: emitDamagePayload,
  createState: () => ({ readyAt: 0 }),
  control(ctx, state, event, { activeConditionStackCount }) {
    if (!isInternalCooldownReady(event.at, state.readyAt)) return;
    if (
      activeConditionStackCount(ctx, 'Confusion', event.at) < REQUIRED_CONDITIONS &&
      activeConditionStackCount(ctx, 'Torment', event.at) < REQUIRED_CONDITIONS
    ) {
      return;
    }

    state.readyAt = event.at + 10;
    emitDamagePayload(ctx, state, event);
  }
});

/** One occurrence shares its payload with simulation after activation checks have succeeded. */
function emitDamagePayload(ctx: Gw2RelicContext, _state: Gw2RelicState, event: SimulationEvent): void {
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
