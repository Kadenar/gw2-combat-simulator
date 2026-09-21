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

/** Projects either canonical strike form into the packet descriptors consumed by profession mechanics. */
export function strikeEffectTicks(effect: StrikeEffect): readonly StrikeTick[] {
  if (effect.ticks) return effect.ticks;
  const hits = Math.max(1, Math.trunc(Number(effect.hits || 1)));
  const coefficient = Number(effect.coefficient || 0) / hits;
  const atMs = Number(effect.atMs || 0);
  return Array.from({ length: hits }, () => ({ atMs, coefficient }));
}

/** Expands either condition authoring form into its individual application descriptors. */
export function conditionEffectTicks(effect: ConditionEffect): readonly ConditionTick[] {
  if (effect.ticks) return effect.ticks;
  const applications = Math.max(1, Math.trunc(Number(effect.applications || 1)));
  const atMs = Number(effect.atMs || 0);
  const intervalMs = Math.max(0, Number(effect.intervalMs || 0));
  return Array.from({ length: applications }, (_, index) => ({
    atMs: atMs + index * intervalMs,
    condition: String(effect.condition || ''),
    stacks: Number(effect.stacks || 0),
    duration: Number(effect.duration || 0)
  }));
}

/** Returns the aggregate coefficient while allowing callers to ignore the authored strike representation. */
export function strikeEffectCoefficient(effect: StrikeEffect): number {
  return strikeEffectTicks(effect).reduce((total, tick) => total + Number(tick.coefficient || 0), 0);
}

/** Returns the first authored packet offset without inventing timing for an inherited effect. */
export function effectFirstAtMs(effect: StrikeEffect | ConditionEffect): number | undefined {
  return effect.ticks?.[0]?.atMs ?? effect.atMs;
}
