import type { SkillEffect } from '#gw2/platform/effects/types.js';

/** Bound authored expansion separately from scheduler iterations, which cannot stop an in-progress allocation. */
export const MAX_EFFECT_EXPANSION = 100_000;

/** Reject unsafe or excessive repetition before traversing or allocating a batch. */
export function requireEffectExpansionCount(count: number, label: string): number {
  if (!Number.isSafeInteger(count) || count < 1 || count > MAX_EFFECT_EXPANSION) {
    throw new RangeError(`${label} requires a positive safe integer count no greater than ${MAX_EFFECT_EXPANSION}.`);
  }

  return count;
}

/** Count the packets one effect will create without materializing them, including explicit tick timelines. */
export function effectApplicationCount(effect: SkillEffect, label: string): number {
  return requireEffectExpansionCount(
    Array.isArray(effect.ticks)
      ? effect.ticks.length
      : effect.type === 'strike'
        ? (effect.hits ?? 1)
        : (effect.applications ?? 1),
    Array.isArray(effect.ticks) ? `${label} ticks` : label
  );
}

/** Condition weights may be fractional, but their per-stack records must fit in a bounded allocation. */
export function validateConditionExpansion(effect: SkillEffect, label: string): void {
  if (effect.type === 'condition') {
    if (effect.ticks) {
      for (const tick of effect.ticks) requireEffectExpansionCount(Math.ceil(tick.stacks), `${label} stacks`);
    } else requireEffectExpansionCount(Math.ceil(Number(effect.stacks)), `${label} stacks`);
  }
}

export interface EffectExpansionBudget {
  /** Reserve a complete batch before mutation; filtered or cancelled work is not refunded. */
  reserve(count: number, label: string): void;
}

/** One runtime shares this cumulative budget across emitted packets and expanded condition-stack records. */
export function createEffectExpansionBudget(limit = MAX_EFFECT_EXPANSION): EffectExpansionBudget {
  let remaining = requireEffectExpansionCount(limit, 'Effect expansion budget');
  return {
    reserve(count, label) {
      if (!Number.isSafeInteger(count) || count < 0 || count > remaining) {
        throw new RangeError(
          `Effect expansion budget (${limit}) exceeded by ${label}: requested ${count}, remaining ${remaining}.`
        );
      }

      remaining -= count;
    }
  };
}
