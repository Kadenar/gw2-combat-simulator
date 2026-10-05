import type {
  ConditionEffect,
  ConditionTick,
  SkillEffect,
  SkillEffectBase,
  StrikeEffect,
  StrikeTick
} from '#gw2/platform/effects/types.js';
import { requireBalanceNumber } from '#gw2/platform/effects/validation.js';

/** Shares one impact's timing without changing effect order, local overrides, or hit eligibility. */
export const impactEffects = (
  timing: Pick<SkillEffectBase, 'atMs' | 'timingAnchor' | 'timingScale' | 'persistsAfterInterrupt'>,
  effects: readonly SkillEffect[]
): SkillEffect[] => effects.map((effect) => ({ ...timing, ...effect }));

const TIMELINE_RESERVED_OPTIONS = new Set(['type', 'ticks']);

/** Keeps caller metadata while protecting the canonical effect fields owned by each timeline factory. */
function withoutTimelineFields<T extends object>(options: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(options).filter(([key, value]) => !TIMELINE_RESERVED_OPTIONS.has(key) && value != null)
  ) as Partial<T>;
}

/** Describes a strike timeline where each hit owns its timing and coefficient. */
export const strikeTimeline = (ticks: readonly StrikeTick[], options: Partial<StrikeEffect> = {}): StrikeEffect => ({
  type: 'strike',
  ticks,
  ...withoutTimelineFields(options)
});

/** Describes a timeline where each condition application owns its timing and payload. */
export const conditionTimeline = (
  ticks: readonly ConditionTick[],
  options: Partial<ConditionEffect> = {}
): ConditionEffect => ({
  type: 'condition',
  ticks,
  ...withoutTimelineFields(options)
});

/** Expands canonical strike fields; an explicit empty derived timeline emits nothing instead of inventing a hit. */
export function strikeEffectTicks(
  effect: Pick<StrikeEffect, 'ticks' | 'hits' | 'coefficient' | 'atMs'>
): readonly StrikeTick[] {
  if (effect.ticks) {
    for (const tick of effect.ticks) {
      requireBalanceNumber(tick.atMs, 'strike tick offset');
      requireBalanceNumber(tick.coefficient, 'strike tick coefficient');
    }

    return effect.ticks;
  }

  const hits = Math.max(1, Math.trunc(effect.hits || 1));
  const coefficient = requireBalanceNumber(effect.coefficient ?? 0, 'strike coefficient') / hits;
  const atMs = effect.atMs || 0;
  return Array.from({ length: hits }, () => ({ atMs, coefficient }));
}

/** Expands canonical conditions with explicit payload values; catalog validation owns authored timeline validity. */
export function conditionEffectTicks(effect: ConditionEffect): readonly ConditionTick[] {
  if (effect.ticks) {
    for (const tick of effect.ticks) {
      requireBalanceNumber(tick.atMs, 'condition tick offset');
      requireBalanceNumber(tick.stacks, 'condition tick stacks');
      requireBalanceNumber(tick.duration, 'condition tick duration');
    }

    return effect.ticks;
  }

  const applications = Math.max(1, Math.trunc(effect.applications || 1));
  const atMs = effect.atMs || 0;
  const intervalMs = Math.max(0, effect.intervalMs || 0);
  const stacks = requireBalanceNumber(effect.stacks, 'condition stacks');
  const duration = requireBalanceNumber(effect.duration, 'condition duration');
  return Array.from({ length: applications }, (_, index) => ({
    atMs: atMs + index * intervalMs,
    condition: effect.condition || '',
    stacks,
    duration
  }));
}

/** Returns the aggregate coefficient while allowing callers to ignore the authored strike representation. */
export function strikeEffectCoefficient(effect: StrikeEffect): number {
  return strikeEffectTicks(effect).reduce((total, tick) => total + (tick.coefficient || 0), 0);
}

/** Returns the first authored packet offset without inventing timing for an inherited effect. */
export function effectFirstAtMs(effect: StrikeEffect | ConditionEffect): number | undefined {
  return effect.ticks?.[0]?.atMs ?? effect.atMs;
}
