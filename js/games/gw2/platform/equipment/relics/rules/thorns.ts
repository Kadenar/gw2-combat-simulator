import { EPSILON } from '#kernel/core/clock.js';
/** Thorns relic rules. */
import { defineRelic } from '#gw2/platform/equipment/relics/rules/shared.js';

const THORNS_CONDITION_DAMAGE_PER_STACK = 30;
const THORNS_MAX_STACKS = 10;
const THORNS_FIRST_STACK_AT = 3;
const THORNS_STACK_INTERVAL = 5;

/**
 * Thorns keeps configured opening stacks, then grants one on the first incoming
 * hit and every 5s thereafter, capped at 10. Golem-benchmark rotations are struck
 * continuously, so stacks ramp monotonically and hold at cap — the same model
 * the display timeline uses, keeping the reported stack count and the applied
 * condition damage in lockstep.
 */
function thornsStacksAt(at: number, configuredInitialStacks: unknown = 0): number {
  const initialStacks = Math.min(THORNS_MAX_STACKS, Math.max(0, Math.trunc(Number(configuredInitialStacks) || 0)));
  if (at < THORNS_FIRST_STACK_AT - EPSILON) return initialStacks;
  const stacks = 1 + Math.floor((at - THORNS_FIRST_STACK_AT + EPSILON) / THORNS_STACK_INTERVAL);
  return Math.min(THORNS_MAX_STACKS, initialStacks + Math.max(0, stacks));
}

export const thorns = defineRelic({
  timeline(ctx, _state, _events, rotationEndTime) {
    const initialStacks = thornsStacksAt(0, ctx.config.initialThornsStacks);
    if (initialStacks > 0) {
      // Thorns stacks persist; numeric proc state lets charts and summaries retain the opening ramp.
      ctx.recordProc(
        'relic',
        'Relic of Thorns',
        0,
        'Initial state',
        `${initialStacks}/${THORNS_MAX_STACKS} stacks`,
        '',
        null,
        null,
        {
          stacks: initialStacks,
          maximumStacks: THORNS_MAX_STACKS
        }
      );
    }

    for (
      let at = THORNS_FIRST_STACK_AT, stacks = initialStacks + 1;
      at <= rotationEndTime + EPSILON && stacks <= THORNS_MAX_STACKS;
      at += THORNS_STACK_INTERVAL, stacks += 1
    ) {
      ctx.recordProc(
        'relic',
        'Relic of Thorns',
        at,
        'Incoming enemy hit',
        `${stacks}/${THORNS_MAX_STACKS} stacks`,
        '',
        null,
        null,
        {
          stacks,
          maximumStacks: THORNS_MAX_STACKS
        }
      );
    }
  },
  // Flat +30 Condition Damage per stack, sampled at tick time so ramping
  // stacks scale live with each condition tick.
  conditionDamageBonus(ctx, _state, at) {
    return thornsStacksAt(at, ctx.config.initialThornsStacks) * THORNS_CONDITION_DAMAGE_PER_STACK;
  }
});
