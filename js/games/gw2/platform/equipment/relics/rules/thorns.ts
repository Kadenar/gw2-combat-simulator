import { EPSILON } from '#kernel/core/clock.js';
import {
  activeRefreshedStacks,
  grantRefreshedStacks,
  type RefreshedStacks
} from '#gw2/platform/combat/resources/refreshed-stacks.js';
import { gw2EffectExpiresAt } from '#gw2/platform/effects/timing.js';
import { defineRelic } from '#gw2/platform/equipment/relics/rules/shared.js';
import type { Gw2RelicContext } from '#gw2/platform/equipment/relics/types.js';

const THORNS_CONDITION_DAMAGE_PER_STACK = 30;
export const THORNS_MAX_STACKS = 10;
const THORNS_FIRST_STACK_AT = 3;
const THORNS_STACK_INTERVAL = 5;
const THORNS_DURATION = 30;

/**
 * Project the existing deterministic proc assumption without simulating incoming damage or mutating query state.
 * Its five-second cadence is shorter than the buff duration, so every earned stack survives to the latest refresh.
 */
function thornsBuffAt(at: number, configuredInitialStacks: unknown = 0): RefreshedStacks {
  const initial = Math.min(THORNS_MAX_STACKS, Math.max(0, Math.trunc(Number(configuredInitialStacks) || 0)));
  const grants =
    at < THORNS_FIRST_STACK_AT - EPSILON
      ? 0
      : 1 + Math.floor((at - THORNS_FIRST_STACK_AT + EPSILON) / THORNS_STACK_INTERVAL);
  const lastGrantAt = grants > 0 ? THORNS_FIRST_STACK_AT + (grants - 1) * THORNS_STACK_INTERVAL : 0;
  return grantRefreshedStacks(
    { stacks: 0, expiresAt: 0 },
    initial + grants,
    lastGrantAt,
    gw2EffectExpiresAt(lastGrantAt, THORNS_DURATION),
    THORNS_MAX_STACKS,
    'exclusive'
  );
}

/** Publish each refreshed deadline so reports retain the same finite stack window as the damage query. */
function reportThornsBuff(ctx: Gw2RelicContext, buff: RefreshedStacks, at: number, sourceSkill: string): void {
  ctx.effects.emit({
    kind: 'announcement',
    announcement: {
      type: 'relic',
      name: 'Relic of Thorns',
      at,
      sourceSkill,
      detail: `${buff.stacks}/${THORNS_MAX_STACKS} stacks`,
      icon: '',
      cooldownReduction: null,
      expiresAt: buff.expiresAt,
      effectState: { stacks: buff.stacks, maximumStacks: THORNS_MAX_STACKS }
    }
  });
}

export const thorns = defineRelic({
  passiveTimeline(ctx, _state, rotationEndTime) {
    const initial = thornsBuffAt(0, ctx.config.initialThornsStacks);
    if (initial.stacks > 0) reportThornsBuff(ctx, initial, 0, 'Initial state');
    // Continue refreshing after reaching the cap; otherwise finite reporting windows would expire during the assumption.
    for (let at = THORNS_FIRST_STACK_AT; at <= rotationEndTime + EPSILON; at += THORNS_STACK_INTERVAL) {
      reportThornsBuff(ctx, thornsBuffAt(at, ctx.config.initialThornsStacks), at, 'Incoming enemy hit');
    }
  },
  // Flat Condition Damage is sampled at tick time, including configured opening stacks and every assumed refresh.
  conditionDamageBonus(ctx, _state, at) {
    return (
      activeRefreshedStacks(thornsBuffAt(at, ctx.config.initialThornsStacks), at, 'exclusive') *
      THORNS_CONDITION_DAMAGE_PER_STACK
    );
  }
});
