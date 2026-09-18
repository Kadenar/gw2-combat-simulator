/** Bloodstone relic rules. */
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
import { defineRelic, timedStrikeBuff } from '#gw2/platform/equipment/relics/rules/shared.js';

export const bloodstone = defineRelic({
  createState: () => ({
    stacks: 0,
    expiresAt: 0,
    buffUntil: 0
  }),
  combo(ctx, state, event) {
    // The shared combo reaction now reaches leap finishers for Steamshrieker; Bloodstone remains blast-only.
    if (event.finisherType !== 'Blast') return;
    // Volatility cannot accumulate while Fervor is active.
    if (Number(state.buffUntil || 0) > event.at) return;
    if (Number(state.expiresAt || 0) <= event.at) state.stacks = 0;

    const currentStacks = Number(state.stacks || 0);
    if (currentStacks < 3) {
      state.stacks = currentStacks + 1;
      state.expiresAt = gw2EffectExpiresAt(event.at, 10);
      ctx.recordProc('relic', 'Bloodstone Volatility', event.at, event.skillName, `${state.stacks}/3 stacks`);
      return;
    }

    // The fourth qualifying blast consumes three Volatility stacks and activates Fervor.
    state.stacks = 0;
    state.expiresAt = 0;
    state.buffUntil = gw2EffectExpiresAt(event.at, 8);
    ctx.recordProc(
      'relic',
      'Relic of Bloodstone',
      event.at,
      event.skillName,
      'Bloodstone Fervor',
      '',
      null,
      Number(state.buffUntil)
    );
    const explosionAt = event.at + 0.68;
    ctx.queue.enqueue({
      type: 'damage',
      at: explosionAt,
      name: 'Bloodstone Explosion',
      skillName: 'Bloodstone Explosion',
      coefficient: 3,
      hits: 1,
      hitIndex: 1,
      totalHits: 1,
      source: 'Relic',
      sourceId: 'relic.bloodstone',
      actorType: 'effect',
      ownerActorType: 'player',
      skillWeapon: 'Unequipped',
      canCrit: true,
      triggeredBy: event.skillName
    });
    ctx.queue.enqueue({
      type: 'condition',
      at: explosionAt,
      name: 'Bloodstone Explosion — Bleeding',
      skillName: 'Bloodstone Explosion',
      condition: 'Bleeding',
      duration: 6,
      stacks: 6,
      source: 'Relic',
      sourceId: 'relic.bloodstone',
      actorType: 'effect',
      ownerActorType: 'player',
      triggeredBy: event.skillName
    });
  },
  // Fervor follows outgoing modifier ownership and also affects the delayed explosion that activated it.
  strikeMultiplier: timedStrikeBuff(1.07, isGw2PlayerModifierOwnedEvent)
});
