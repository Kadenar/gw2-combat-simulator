/** Fractal relic rules. */
import { isInternalCooldownReady } from '#gw2/platform/combat/procs/registry.js';
import { isIndependentConditionOwner } from '#gw2/platform/combat/state/event-ownership.js';
import { CONDITION } from '#gw2/platform/constants.js';
import { RELIC_IDS } from '#gw2/platform/equipment/relics/data.js';
import { announceRelic, defineRelic, playerOwnedRelicSource } from '#gw2/platform/equipment/relics/rules/shared.js';
import type { Gw2RelicContext } from '#gw2/platform/equipment/relics/types.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';

// Five existing bleeds qualify because the incoming application supplies the sixth.
const REQUIRED_BLEEDING = 5;

export const fractal = defineRelic({
  damagePayload: emitDamagePayload,
  createState: () => ({ readyAt: 0 }),
  condition(ctx, state, application, { conditionStackIndex, activeConditionStackCount }) {
    if (
      application.condition !== CONDITION.BLEEDING ||
      // Siblings share one instant and the cooldown, so only the first stack can trigger. Later siblings must not
      // count earlier ones toward the threshold.
      conditionStackIndex !== 1 ||
      // Only bleeding the player owns arms the relic. Pets and the mech own the bleeding they apply, so their
      // applications never trigger it; other summons share the player's condition packets and still do.
      isIndependentConditionOwner(application) ||
      !isInternalCooldownReady(application.at, state.readyAt) ||
      // The first stack is already on the target. Exclude it to compare the count before this application.
      activeConditionStackCount(ctx, CONDITION.BLEEDING, application.at) - Number(application.stacks) <
        REQUIRED_BLEEDING
    ) {
      return;
    }

    // Relic damage stays effect-sourced while explicitly inheriting the player's outgoing modifiers.
    state.readyAt = application.at + 20;
    emitDamagePayload(ctx, application);
  }
});

/** One occurrence shares its payload with simulation after activation checks have succeeded. */
function emitDamagePayload(ctx: Gw2RelicContext, application: SimulationEvent): void {
  announceRelic(ctx, application, 'Relic of the Fractal');
  ctx.effects.emit({
    kind: 'packet',
    settlement: 'reaction',
    event: {
      type: 'condition',
      at: application.at,
      name: 'Relic of the Fractal - Burning',
      skillName: 'Relic of the Fractal',
      condition: CONDITION.BURNING,
      duration: 8,
      stacks: 2,
      ...playerOwnedRelicSource(RELIC_IDS.FRACTAL)
    }
  });
  ctx.effects.emit({
    kind: 'packet',
    settlement: 'reaction',
    event: {
      type: 'condition',
      at: application.at,
      name: 'Relic of the Fractal - Torment',
      skillName: 'Relic of the Fractal',
      condition: CONDITION.TORMENT,
      duration: 8,
      stacks: 3,
      ...playerOwnedRelicSource(RELIC_IDS.FRACTAL)
    }
  });
}
