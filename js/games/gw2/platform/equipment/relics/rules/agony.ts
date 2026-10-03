import { isInternalCooldownReady } from '#gw2/platform/combat/procs.js';
import { RELIC_IDS, RELIC_BY_ID } from '#gw2/platform/equipment/relics/data.js';
import { defineRelic } from '#gw2/platform/equipment/relics/rules/shared.js';

/** Resolved interrupts share Severance's control trigger; each proc adds five independent, unmodified damage ticks. */
export const agony = defineRelic({
  createState: () => ({ readyAt: 0 }),
  control(ctx, state, event) {
    // Like Severance, controls before the explicit combat boundary cannot consume the proc's cooldown.
    if (ctx.combatStartPending || (ctx.combatStartTime != null && event.at < ctx.combatStartTime)) return;
    if (!isInternalCooldownReady(event.at, state.readyAt)) return;
    state.readyAt = event.at + RELIC_BY_ID[RELIC_IDS.AGONY].cooldown;
    ctx.recordProc('relic', 'Relic of Agony', event.at, event.skillName, '', RELIC_BY_ID[RELIC_IDS.AGONY].icon);
    // This effect is not a condition: fixed ticks bypass duration, vulnerability, and outgoing damage modifiers.
    for (let second = 1; second <= 5; second += 1) {
      ctx.queue.enqueue({
        type: 'damage',
        at: event.at + second,
        name: 'Agony of the Choir',
        skillName: 'Relic of Agony',
        source: 'Relic',
        sourceId: `relic.${RELIC_IDS.AGONY}`,
        actorType: 'effect',
        ownerActorType: 'player',
        triggeredBy: event.skillName,
        icon: RELIC_BY_ID[RELIC_IDS.AGONY].icon,
        flatDamage: 134.5,
        flatDamageConditionCoeff: 0.155,
        damageKind: 'condition',
        canCrit: false,
        canTriggerCriticalSigils: false,
        canTriggerCriticalTraits: false
      });
    }
  }
});
