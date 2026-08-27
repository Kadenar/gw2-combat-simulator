import type { ConditionEffect, ConditionTick, SchedulerRecord, StrikeEffect, StrikeTick } from '../types.js';

const TIMELINE_RESERVED_OPTIONS = new Set(['type', 'ticks']);

/** Keeps caller metadata while protecting the canonical effect fields owned by each timeline factory. */
function withoutTimelineFields(options: Readonly<SchedulerRecord>): SchedulerRecord {
  return Object.fromEntries(
    Object.entries(options).filter(([key, value]) => !TIMELINE_RESERVED_OPTIONS.has(key) && value != null)
  );
}

/** Describes a strike timeline where each hit owns its timing and coefficient. */
export const strikeTimeline = (ticks: readonly StrikeTick[], options: Readonly<SchedulerRecord> = {}): StrikeEffect =>
  ({
    type: 'strike',
    ticks,
    ...withoutTimelineFields(options)
  }) as StrikeEffect;

/** Describes a timeline where each condition application owns its timing and payload. */
export const conditionTimeline = (
  ticks: readonly ConditionTick[],
  options: Readonly<SchedulerRecord> = {}
): ConditionEffect =>
  ({
    type: 'condition',
    ticks,
    ...withoutTimelineFields(options)
  }) as ConditionEffect;
