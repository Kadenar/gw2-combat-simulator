/** Mirage relic rules. */
import { isInternalCooldownReady } from '#gw2/platform/combat/procs/registry.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { CONDITION } from '#gw2/platform/constants.js';
import { RELIC_IDS } from '#gw2/platform/equipment/relics/data.js';
import { announceRelic, defineRelic, playerOwnedRelicSource } from '#gw2/platform/equipment/relics/rules/shared.js';
import type { Gw2RelicContext, Gw2RelicState } from '#gw2/platform/equipment/relics/types.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';

export const mirage = defineRelic({
  damagePayload: emitDamagePayload,
  createState: () => ({ readyAt: -Infinity }),
  action(ctx, state, dodge) {
    // A successful player evade claims the same ICD once, at its actual activation.
    if (
      !isGw2PlayerActorEvent(dodge) ||
      dodge.cancelled ||
      dodge.at < (ctx.engagement.startTime ?? 0) ||
      !(dodge.evades === true || ['Dodge', 'Dodge / Mirage Cloak'].includes(String(dodge.skillName))) ||
      !isInternalCooldownReady(dodge.at, state.readyAt)
    )
      return;

    state.readyAt = dodge.at + 1;
    emitDamagePayload(ctx, state, dodge);
  },
  condition(ctx, _state, application) {
    if (application.sourceId === `relic.${RELIC_IDS.MIRAGE}`) {
      announceRelic(ctx, application, 'Relic of the Mirage', {
        sourceSkill: application.triggeredBy,
        detail: '2 Torment for 6s'
      });
    }
  }
});

/** One occurrence shares its payload with simulation after activation checks have succeeded. */
function emitDamagePayload(ctx: Gw2RelicContext, _state: Gw2RelicState, dodge: SimulationEvent): void {
  ctx.effects.emit({
    kind: 'packet',
    event: {
      type: 'condition',
      at: dodge.at,
      ...playerOwnedRelicSource(RELIC_IDS.MIRAGE),
      triggeredBy: dodge.skillName,
      skillName: 'Relic of the Mirage',
      name: 'Relic of the Mirage — Torment',
      condition: CONDITION.TORMENT,
      stacks: 2,
      duration: 6
    }
  });
}
