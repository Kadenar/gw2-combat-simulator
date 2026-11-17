import { gw2EffectExpiresAt } from '#gw2/platform/combat/effect-timing.js';
import { defineRelic } from '#gw2/platform/equipment/relics/rules/shared.js';
import type { Gw2RelicContext } from '#gw2/platform/equipment/relics/types.js';
import { timeKey } from '#kernel/core/clock.js';
import { activeBatchCount, createBatch, type Batch } from '#kernel/resources/batch.js';

const THORNS_CONDITION_DAMAGE_PER_STACK = 30;

export const THORNS_MAX_STACKS = 10;
const THORNS_FIRST_STACK_AT = 3;
const THORNS_STACK_INTERVAL = 5;
const THORNS_DURATION = 30;

/**
 * Project the existing deterministic proc assumption without simulating incoming damage or mutating query state.
 * Its five-second cadence is shorter than the buff duration, so every earned stack survives to the latest refresh.
 */
function thornsBuffAt(at: number, configuredInitialStacks: unknown = 0): Batch {
  const initial = Math.min(THORNS_MAX_STACKS, Math.max(0, Math.trunc(Number(configuredInitialStacks) || 0)));
  // Count only elapsed grants using integer clock units; a future grant cannot improve current damage.
  const elapsed = timeKey(at) - timeKey(THORNS_FIRST_STACK_AT);
  const grants = elapsed < 0 ? 0 : 1 + Math.floor(elapsed / timeKey(THORNS_STACK_INTERVAL));
  const lastGrantAt = grants > 0 ? THORNS_FIRST_STACK_AT + (grants - 1) * THORNS_STACK_INTERVAL : 0;
  // This projection has no previous batch to refresh; construct its capped count and deadline directly.
  return createBatch(Math.min(THORNS_MAX_STACKS, initial + grants), gw2EffectExpiresAt(lastGrantAt, THORNS_DURATION));
}

/** Publish each refreshed deadline so reports retain the same finite stack window as the damage query. */
function reportThornsBuff(ctx: Gw2RelicContext, buff: Batch, at: number, sourceSkill: string): void {
  ctx.effects.emit({
    kind: 'announcement',
    announcement: {
      type: 'relic',
      name: 'Relic of Thorns',
      at,
      sourceSkill,
      detail: `${buff.count}/${THORNS_MAX_STACKS} stacks`,
      icon: '',
      cooldownReduction: null,
      expiresAt: buff.expiresAt,
      effectState: { stacks: buff.count, maximumStacks: THORNS_MAX_STACKS }
    }
  });
}

export const thorns = defineRelic({
  passiveTimeline(ctx, _state, rotationEndTime) {
    const initial = thornsBuffAt(0, ctx.config.initialThornsStacks);

    if (initial.count > 0) reportThornsBuff(ctx, initial, 0, 'Initial state');

    // Continue refreshing after reaching the cap; otherwise finite reporting windows would expire during the assumption.
    for (let at = THORNS_FIRST_STACK_AT; timeKey(at) <= timeKey(rotationEndTime); at += THORNS_STACK_INTERVAL) {
      reportThornsBuff(ctx, thornsBuffAt(at, ctx.config.initialThornsStacks), at, 'Incoming enemy hit');
    }
  },
  // Flat Condition Damage is sampled at tick time, including configured opening stacks and every assumed refresh.
  conditionDamageBonus(ctx, at) {
    return (
      activeBatchCount(thornsBuffAt(at, ctx.config.initialThornsStacks), at, 'exclusive') *
      THORNS_CONDITION_DAMAGE_PER_STACK
    );
  }
});
