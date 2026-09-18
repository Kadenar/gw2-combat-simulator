import type {
  ConditionEffect,
  ConditionTick,
  SkillEffect,
  SkillEffectBase,
  StrikeEffect,
  StrikeTick
} from '#gw2/platform/engine/skills/types.js';

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
export const strikeTimeline = (ticks: readonly StrikeTick[], options: Partial<StrikeEffect> = {}): StrikeEffect =>
  ({
    type: 'strike',
    ticks,
    ...withoutTimelineFields(options)
  }) as StrikeEffect;

/** Describes a timeline where each condition application owns its timing and payload. */
export const conditionTimeline = (
  ticks: readonly ConditionTick[],
  options: Partial<ConditionEffect> = {}
): ConditionEffect =>
  ({
    type: 'condition',
    ticks,
    ...withoutTimelineFields(options)
  }) as ConditionEffect;
