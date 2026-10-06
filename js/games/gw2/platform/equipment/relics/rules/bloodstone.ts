import type { SimulationEvent } from '#gw2/platform/events/events.js';
import { RELIC_IDS } from '#gw2/platform/equipment/relics/data.js';
import type { Gw2RelicContext, Gw2RelicState } from '#gw2/platform/equipment/relics/types.js';
/** Bloodstone relic rules. */
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import {
  defineRelic,
  recordTimedBuffProc,
  relicBuffActive,
  timedStrikeBuff
} from '#gw2/platform/equipment/relics/rules/shared.js';
import { gw2EffectExpiresAt } from '#gw2/platform/effects/timing.js';
import { activeRefreshedStacks, grantRefreshedStacks } from '#gw2/platform/combat/resources/refreshed-stacks.js';

// The fourth qualifying blast consumes the native three-stack pool.
const VOLATILITY_STACKS = 3;
export const bloodstone = defineRelic({
  buffPolicies: [{ kind: 'bloodstone-fervor', name: 'Relic of Bloodstone', maximumStacks: 1 }],
  damagePayload: emitDamagePayload,
  createState: () => ({
    refreshedStacks: { stacks: 0, expiresAt: 0 }
  }),
  combo(ctx, state, event) {
    // The shared combo reaction now reaches leap finishers for Steamshrieker; Bloodstone remains blast-only.
    if (event.finisherType !== 'Blast') return;
    // Volatility cannot accumulate while Fervor is active.
    if (relicBuffActive(ctx, 'bloodstone-fervor', event.at)) return;
    const currentStacks = activeRefreshedStacks(state.refreshedStacks, event.at, 'exclusive');
    if (currentStacks < VOLATILITY_STACKS) {
      // Each blast renews all Volatility stacks; the next blast at cap still belongs to the Fervor transition.
      const buff = grantRefreshedStacks(
        state.refreshedStacks!,
        1,
        event.at,
        gw2EffectExpiresAt(event.at, 10),
        VOLATILITY_STACKS,
        'exclusive'
      );
      state.refreshedStacks = buff;
      ctx.effects.emit({
        kind: 'announcement',
        announcement: {
          type: 'relic',
          name: 'Bloodstone Volatility',
          at: event.at,
          sourceSkill: event.skillName,
          detail: `${buff.stacks}/3 stacks`,
          expiresAt: buff.expiresAt,
          effectState: { stacks: buff.stacks, maximumStacks: VOLATILITY_STACKS }
        }
      });
      return;
    }

    // The fourth qualifying blast consumes three Volatility stacks and activates Fervor.
    state.refreshedStacks = { stacks: 0, expiresAt: 0 };
    ctx.effects.emit({
      kind: 'announcement',
      announcement: {
        type: 'relic',
        name: 'Bloodstone Volatility',
        at: event.at,
        sourceSkill: event.skillName,
        detail: 'stacks consumed',
        expiresAt: event.at,
        effectState: { stacks: 0, maximumStacks: VOLATILITY_STACKS }
      }
    });
    emitDamagePayload(ctx, state, event);
  },
  // Fervor follows outgoing modifier ownership and also affects the delayed explosion that activated it.
  strikeMultiplier: timedStrikeBuff('bloodstone-fervor', 1.07, isGw2PlayerModifierOwnedEvent)
});

/** One occurrence shares its payload with simulation after activation checks have succeeded. */
function emitDamagePayload(ctx: Gw2RelicContext, _state: Gw2RelicState, event: SimulationEvent): void {
  recordTimedBuffProc(ctx, event, {
    relicId: RELIC_IDS.BLOODSTONE,
    kind: 'bloodstone-fervor',
    duration: 8,
    name: 'Relic of Bloodstone',
    detail: 'Bloodstone Fervor'
  });
  const explosionAt = event.at + 0.68;
  ctx.effects.emit({
    kind: 'packet',
    event: {
      type: 'damage',
      at: explosionAt,
      name: 'Bloodstone Explosion',
      skillName: 'Bloodstone Explosion',
      coefficient: 3,
      hits: 1,
      hitIndex: 1,
      totalHits: 1,
      source: 'Relic',
      sourceId: `relic.${RELIC_IDS.BLOODSTONE}`,
      actorType: 'effect',
      ownerActorType: 'player',
      skillWeapon: 'Unequipped',
      canCrit: true,
      triggeredBy: event.skillName
    }
  });
  ctx.effects.emit({
    kind: 'packet',
    event: {
      type: 'condition',
      at: explosionAt,
      name: 'Bloodstone Explosion — Bleeding',
      skillName: 'Bloodstone Explosion',
      condition: 'Bleeding',
      duration: 6,
      stacks: 6,
      source: 'Relic',
      sourceId: `relic.${RELIC_IDS.BLOODSTONE}`,
      actorType: 'effect',
      ownerActorType: 'player',
      triggeredBy: event.skillName
    }
  });
}
