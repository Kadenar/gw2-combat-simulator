/** Shackles relic rules. */
import { isInternalCooldownReady } from '#gw2/platform/combat/procs/registry.js';
import { gw2EventActorType } from '#gw2/platform/combat/state/event-ownership.js';
import { ACTOR, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import { RELIC_IDS } from '#gw2/platform/equipment/relics/data.js';
import { defineRelic, playerOwnedRelicSource, relicSource } from '#gw2/platform/equipment/relics/rules/shared.js';
import type { Gw2RelicContext } from '#gw2/platform/equipment/relics/types.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';

export const shackles = defineRelic({
  damagePayload: emitDamagePayload,
  createState: () => ({ readyAt: 0 }),
  emitConditionEffects(ctx, state, application) {
    const actorType = gw2EventActorType(application);

    if (
      application.condition !== CONDITION.IMMOBILIZED ||
      (actorType !== ACTOR.PLAYER && actorType !== ACTOR.SUMMON) ||
      !isInternalCooldownReady(application.at, state.readyAt)
    ) {
      return;
    }

    state.readyAt = application.at + 10;
    emitDamagePayload(ctx, application);
  },
  damageResolved(ctx, event) {
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
function emitDamagePayload(ctx: Pick<Gw2RelicContext, 'effects'>, application: SimulationEvent): void {
  // The tether marker reports the activation without consuming a combat packet identity.
  ctx.effects.emit({
    kind: 'announcement',
    log: true,
    cause: application,
    attribution: relicSource(RELIC_IDS.SHACKLES),
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
      ...playerOwnedRelicSource(RELIC_IDS.SHACKLES),
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
      controlKind: CONTROL.STUN,
      ...relicSource(RELIC_IDS.SHACKLES),
      triggeredBy: application.skillName
    }
  });
}
