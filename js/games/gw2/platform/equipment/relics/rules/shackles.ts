/** Shackles relic rules. */
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { GW2_EVENT_ACTOR_TYPES, gw2EventActorType } from '#gw2/platform/combat/state/event-ownership.js';
import { defineRelic } from '#gw2/platform/equipment/relics/rules/shared.js';

export const shackles = defineRelic({
  createState: () => ({ readyAt: 0 }),
  materializeCondition(ctx, state, application) {
    const actorType = gw2EventActorType(application);
    if (
      application?.condition !== 'Immobilized' ||
      (actorType !== GW2_EVENT_ACTOR_TYPES.PLAYER && actorType !== GW2_EVENT_ACTOR_TYPES.SUMMON) ||
      !isInternalCooldownReady(application.at, state.readyAt)
    ) {
      return;
    }

    state.readyAt = application.at + 10;
    ctx.emitDerived(application, {
      type: 'proc',
      procType: 'relic',
      at: application.at,
      name: 'Relic of the Shackles',
      sourceSkill: application.skillName,
      detail: 'tethered',
      source: 'Relic',
      sourceId: 'relic.shackles',
      actorType: 'effect'
    });
    ctx.emitDerived(application, {
      type: 'damage',
      at: application.at + 5,
      name: 'Relic of the Shackles',
      skillName: 'Relic of the Shackles',
      coefficient: 3,
      hits: 1,
      hitIndex: 1,
      totalHits: 1,
      source: 'Relic',
      sourceId: 'relic.shackles',
      actorType: 'effect',
      ownerActorType: 'player',
      skillWeapon: 'Unequipped',
      canCrit: true,
      triggeredBy: application.skillName
    });
    ctx.emitDerived(application, {
      type: 'control',
      at: application.at + 5,
      name: 'Relic of the Shackles',
      skillName: 'Relic of the Shackles',
      controlKind: 'stun',
      source: 'Relic',
      sourceId: 'relic.shackles',
      actorType: 'effect',
      triggeredBy: application.skillName
    });
  },
  damageResolved(ctx, _state, event) {
    if (
      event?.type !== 'damage' ||
      event.sourceId !== 'relic.shackles' ||
      event.skillName !== 'Relic of the Shackles'
    ) {
      return;
    }

    ctx.recordProc('relic', 'Relic of the Shackles', event.at, event.triggeredBy, 'damage');
  }
});
