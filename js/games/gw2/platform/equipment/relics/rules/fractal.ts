/** Fractal relic rules. */
import { isInternalCooldownReady } from '#gw2/platform/combat/procs/registry.js';
import { ACTOR, CONDITION } from '#gw2/platform/constants.js';
import { RELIC_IDS } from '#gw2/platform/equipment/relics/data.js';
import { defineRelic } from '#gw2/platform/equipment/relics/rules/shared.js';
import type { Gw2RelicContext, Gw2RelicState } from '#gw2/platform/equipment/relics/types.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';

// Five existing bleeds qualify because the incoming application supplies the sixth.
const REQUIRED_BLEEDING = 5;

export const fractal = defineRelic({
  damagePayload: emitDamagePayload,
  createState: () => ({ readyAt: 0 }),
  condition(ctx, state, application, { stacksBeforeApplication }) {
    if (
      application.condition !== CONDITION.BLEEDING ||
      // Only bleeding the player owns arms the relic. Pets and the mech own the bleeding they apply, so their
      // applications never trigger it; other summons share the player's condition packets and still do.
      (application.actorType === ACTOR.SUMMON && application.independentConditionOwner === true) ||
      !isInternalCooldownReady(application.at, state.readyAt) ||
      stacksBeforeApplication < REQUIRED_BLEEDING
    ) {
      return;
    }

    // The resolver snapshots the threshold before the whole application; sibling stacks cannot qualify each other.
    // Relic damage stays effect-sourced while explicitly inheriting the player's outgoing modifiers.
    state.readyAt = application.at + 20;
    emitDamagePayload(ctx, state, application);
  }
});

/** One occurrence shares its payload with simulation after activation checks have succeeded. */
function emitDamagePayload(ctx: Gw2RelicContext, _state: Gw2RelicState, application: SimulationEvent): void {
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
      condition: CONDITION.BURNING,
      duration: 8,
      stacks: 2,
      source: 'Relic',
      sourceId: `relic.${RELIC_IDS.FRACTAL}`,
      actorType: ACTOR.EFFECT,
      ownerActorType: ACTOR.PLAYER
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
      condition: CONDITION.TORMENT,
      duration: 8,
      stacks: 3,
      source: 'Relic',
      sourceId: `relic.${RELIC_IDS.FRACTAL}`,
      actorType: ACTOR.EFFECT,
      ownerActorType: ACTOR.PLAYER
    }
  });
}
