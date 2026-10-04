import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import { RELIC_IDS } from '#gw2/platform/equipment/relics/data.js';
import type { Gw2RelicContext, Gw2RelicState } from '#gw2/platform/equipment/relics/types.js';
/** Shackles relic rules. */
import { isInternalCooldownReady } from '#gw2/platform/combat/procs.js';
import { gw2EventActorType } from '#gw2/platform/combat/state/event-ownership.js';
import { GW2_EVENT_ACTOR_TYPES } from '#gw2/platform/engine/events/actors.js';
import { defineRelic } from '#gw2/platform/equipment/relics/rules/shared.js';

export const shackles = defineRelic({
  damagePayload: emitDamagePayload,
  createState: () => ({ readyAt: 0 }),
  emitConditionEffects(ctx, state, application) {
    const actorType = gw2EventActorType(application);
    if (
      application.condition !== 'Immobilized' ||
      (actorType !== GW2_EVENT_ACTOR_TYPES.PLAYER && actorType !== GW2_EVENT_ACTOR_TYPES.SUMMON) ||
      !isInternalCooldownReady(application.at, state.readyAt)
    ) {
      return;
    }

    state.readyAt = application.at + 10;
    emitDamagePayload(ctx, state, application);
  },
  damageResolved(ctx, _state, event) {
    // The relic emits exactly one damage packet under its source ID, so the ID alone identifies it.
    if (event.type !== 'damage' || event.sourceId !== `relic.${RELIC_IDS.SHACKLES}`) return;

    ctx.effects.emit({
      kind: 'announcement',
      announcement: {
        type: 'relic',
        name: 'Relic of the Shackles',
        at: event.at,
        sourceSkill: event.triggeredBy,
        detail: 'damage'
      }
    });
  }
});

/** One occurrence shares its payload with simulation after activation checks have succeeded. */
function emitDamagePayload(
  ctx: Pick<Gw2RelicContext, 'effects'>,
  _state: Gw2RelicState,
  application: SimulationEvent
): void {
  // The tether marker reports the activation without consuming a combat packet identity.
  ctx.effects.emit({
    kind: 'announcement',
    log: true,
    cause: application,
    attribution: { source: 'Relic', sourceId: `relic.${RELIC_IDS.SHACKLES}`, actorType: 'effect' },
    announcement: {
      type: 'relic',
      name: 'Relic of the Shackles',
      at: application.at,
      sourceSkill: application.skillName,
      detail: 'tethered'
    }
  });
  ctx.effects.emit({
    kind: 'packet',
    cause: application,
    event: {
      type: 'damage',
      at: application.at + 5,
      name: 'Relic of the Shackles',
      skillName: 'Relic of the Shackles',
      coefficient: 3,
      hits: 1,
      hitIndex: 1,
      totalHits: 1,
      source: 'Relic',
      sourceId: `relic.${RELIC_IDS.SHACKLES}`,
      actorType: 'effect',
      ownerActorType: 'player',
      skillWeapon: 'Unequipped',
      canCrit: true,
      triggeredBy: application.skillName
    }
  });
  ctx.effects.emit({
    kind: 'packet',
    cause: application,
    event: {
      type: 'control',
      at: application.at + 5,
      name: 'Relic of the Shackles',
      skillName: 'Relic of the Shackles',
      controlKind: 'stun',
      source: 'Relic',
      sourceId: `relic.${RELIC_IDS.SHACKLES}`,
      actorType: 'effect',
      triggeredBy: application.skillName
    }
  });
}
