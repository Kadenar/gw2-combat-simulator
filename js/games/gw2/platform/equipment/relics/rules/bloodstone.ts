import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import { RELIC_IDS } from '#gw2/platform/equipment/relics/data.js';
import type { Gw2RelicContext, Gw2RelicState } from '#gw2/platform/equipment/relics/types.js';
/** Bloodstone relic rules. */
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { defineRelic, timedStrikeBuff } from '#gw2/platform/equipment/relics/rules/shared.js';
import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';

// The fourth qualifying blast consumes the native three-stack pool.
const VOLATILITY_STACKS = 3;
export const bloodstone = defineRelic({
  damagePayload: emitDamagePayload,
  createState: () => ({
    stacks: 0,
    expiresAt: 0,
    buffUntil: 0
  }),
  combo(ctx, state, event) {
    // The shared combo reaction now reaches leap finishers for Steamshrieker; Bloodstone remains blast-only.
    if (event.finisherType !== 'Blast') return;
    // Volatility cannot accumulate while Fervor is active.
    if ((state.buffUntil || 0) > event.at) return;
    if ((state.expiresAt || 0) <= event.at) state.stacks = 0;

    const currentStacks = state.stacks || 0;
    if (currentStacks < VOLATILITY_STACKS) {
      state.stacks = currentStacks + 1;
      state.expiresAt = gw2EffectExpiresAt(event.at, 10);
      ctx.effects.emit({
        kind: 'announcement',
        announcement: {
          type: 'relic',
          name: 'Bloodstone Volatility',
          at: event.at,
          sourceSkill: event.skillName,
          detail: `${state.stacks}/3 stacks`
        }
      });
      return;
    }

    // The fourth qualifying blast consumes three Volatility stacks and activates Fervor.
    state.stacks = 0;
    state.expiresAt = 0;
    emitDamagePayload(ctx, state, event);
  },
  // Fervor follows outgoing modifier ownership and also affects the delayed explosion that activated it.
  strikeMultiplier: timedStrikeBuff(1.07, isGw2PlayerModifierOwnedEvent)
});

/** One occurrence shares its payload with simulation after activation checks have succeeded. */
function emitDamagePayload(ctx: Gw2RelicContext, state: Gw2RelicState, event: SimulationEvent): void {
  state.buffUntil = gw2EffectExpiresAt(event.at, 8);
  ctx.effects.emit({
    kind: 'announcement',
    announcement: {
      type: 'relic',
      name: 'Relic of Bloodstone',
      at: event.at,
      sourceSkill: event.skillName,
      detail: 'Bloodstone Fervor',
      icon: '',
      cooldownReduction: null,
      expiresAt: state.buffUntil
    }
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
