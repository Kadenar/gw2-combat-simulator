/** Last Tyrant relic rules. */
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { missesTarget } from '#gw2/platform/combat/state/targets.js';
import { defineRelic } from '#gw2/platform/equipment/relics/rules/shared.js';
import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';

const LAST_TYRANT_STACKS_NEEDED = 5;
const LAST_TYRANT_STACK_INTERNAL_COOLDOWN = 0.25;
const LAST_TYRANT_INTERNAL_COOLDOWN = 12;
const LAST_TYRANT_EXPLOSION_COEFFICIENT = 3;

export const lastTyrant = defineRelic({
  createState: () => ({ readyAt: 0, stackReadyAt: 0, stacks: 0 }),
  condition(ctx, state, application, { applyCondition }) {
    // The explosion's own burning cannot feed Tyrant's Fury.
    if (
      application.condition !== 'Burning' ||
      application.sourceId === 'relic.last-tyrant' ||
      missesTarget(application) ||
      !(
        isGw2PlayerActorEvent(application) ||
        (application.actorType === 'effect' && application.ownerActorType === 'player')
      ) ||
      !(Number(application.stacks) > 0)
    ) {
      return;
    }

    // The explosion's 12s cooldown blocks a new Fury cycle.
    if (!isInternalCooldownReady(application.at, state.readyAt)) return;

    const stacks = Number(state.stacks || 0);
    if (stacks < LAST_TYRANT_STACKS_NEEDED) {
      // Fury's 250ms marker expires on the next 40ms tick; an application at expiry can grant a stack.
      if (application.at < Number(state.stackReadyAt || 0)) return;
      state.stacks = stacks + 1;
      state.stackReadyAt = gw2EffectExpiresAt(application.at, LAST_TYRANT_STACK_INTERNAL_COOLDOWN);
      ctx.recordProc(
        'relic',
        'Relic of the Last Tyrant',
        application.at,
        application.skillName,
        `${state.stacks}/${LAST_TYRANT_STACKS_NEEDED} stacks`,
        '',
        null,
        null,
        { stacks: Number(state.stacks), maximumStacks: LAST_TYRANT_STACKS_NEEDED }
      );
      return;
    }

    // At max Fury stacks, the next burning application explodes even while the short marker is active.
    state.stacks = 0;
    state.readyAt = application.at + LAST_TYRANT_INTERNAL_COOLDOWN;
    ctx.recordProc('relic', 'Relic of the Last Tyrant', application.at, application.skillName, 'explosion');
    ctx.queue.enqueue({
      type: 'damage',
      at: application.at,
      name: 'Relic of the Last Tyrant',
      skillName: 'Relic of the Last Tyrant',
      coefficient: LAST_TYRANT_EXPLOSION_COEFFICIENT,
      hits: 1,
      hitIndex: 1,
      totalHits: 1,
      source: 'Relic',
      sourceId: 'relic.last-tyrant',
      actorType: 'effect',
      ownerActorType: 'player',
      skillWeapon: 'Unequipped',
      canCrit: true,
      triggeredBy: application.skillName
    });

    applyCondition(ctx, {
      type: 'condition',
      at: application.at,
      name: 'Relic of the Last Tyrant — Burning',
      skillName: 'Relic of the Last Tyrant',
      condition: 'Burning',
      duration: 8,
      stacks: 2,
      source: 'Relic',
      sourceId: 'relic.last-tyrant',
      actorType: 'effect',
      ownerActorType: 'player',
      triggeredBy: application.skillName
    });
  }
});
