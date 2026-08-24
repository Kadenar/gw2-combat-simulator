/**
 * Declarative effect builders (`strike`, `condition`, `boon`, `control`,
 * `custom`, and friends) used by profession mechanics and canonical catalogs.
 * Each returns a normalized effect object with reserved fields stripped so
 * declarative skill data stays compact while validating cleanly during catalog
 * assembly.
 */
import type {
  ConditionEffect,
  ConditionTick,
  CustomEffect,
  SchedulerRecord,
  SkillEffect,
  StatusEffect,
  StrikeEffect,
  StrikeTick
} from '../types.js';

type ConditionOptions = Readonly<SchedulerRecord> & {
  readonly atMs?: number;
  readonly metadata?: Readonly<SchedulerRecord>;
};

type RepeatedConditionOptions = Readonly<SchedulerRecord> & {
  readonly count: number;
  readonly duration: number;
  readonly firstAtMs?: number;
  readonly intervalMs?: number;
  readonly stacks?: number;
};

// Declarative effect builders used by profession mechanics and canonical
// catalogs. They normalize reserved fields so declarative skill data stays
// compact while still validating cleanly in catalog assembly.

/**
 * Removes fields that are owned by a specific factory so callers can still
 * attach arbitrary metadata without clobbering canonical keys.
 *
 * @param {Readonly<SchedulerRecord>} options
 * @param {ReadonlySet<string>} reserved
 * @returns {SchedulerRecord}
 */
function withoutReservedOptions(options: Readonly<SchedulerRecord>, reserved: ReadonlySet<string>): SchedulerRecord {
  return Object.fromEntries(
    Object.entries(options || {}).filter(([key, value]) => !reserved.has(key) && value != null)
  );
}

const STRIKE_RESERVED_OPTIONS = new Set(['type', 'coefficient', 'hits']);
const TIMELINE_RESERVED_OPTIONS = new Set(['type', 'ticks']);
const CONDITION_RESERVED_OPTIONS = new Set(['type', 'condition', 'stacks', 'duration', 'atMs', 'metadata']);
const CONTROL_RESERVED_OPTIONS = new Set(['type', 'atMs', 'metadata']);
const TIMED_RESERVED_OPTIONS = new Set(['type', 'atMs']);
const STATUS_RESERVED_OPTIONS = new Set(['type', 'boon', 'kind', 'duration', 'stacks']);
const CUSTOM_RESERVED_OPTIONS = new Set(['type', 'eventType', 'atMs', 'event']);

/**
 * Describes one or more strike hits that share a total coefficient.
 *
 * @param {number} coefficient
 * @param {Readonly<SchedulerRecord> & {hits?: number}} [options]
 * @returns {StrikeEffect}
 */
export const strike = (
  coefficient: number,
  options: Readonly<SchedulerRecord> & { readonly hits?: number } = {}
): StrikeEffect =>
  ({
    type: 'strike',
    coefficient,
    hits: options.hits ?? 1,
    ...withoutReservedOptions(options, STRIKE_RESERVED_OPTIONS)
  }) as StrikeEffect;

/**
 * Describes an explicit strike timeline where each hit owns its own timing and
 * coefficient.
 *
 * @param {readonly StrikeTick[]} ticks
 * @param {Readonly<SchedulerRecord>} [options]
 * @returns {StrikeEffect}
 */
export const strikeTimeline = (ticks: readonly StrikeTick[], options: Readonly<SchedulerRecord> = {}): StrikeEffect =>
  ({
    type: 'strike',
    ticks,
    ...withoutReservedOptions(options, TIMELINE_RESERVED_OPTIONS)
  }) as StrikeEffect;

/**
 * Describes an irregular exact strike timeline with an aggregate coefficient.
 *
 * The canonical catalog stores per-packet coefficients in `ticks`; this helper
 * keeps hand-authored equal-packet timelines concise without introducing a
 * second parallel-array representation such as `atMsList`.
 *
 * @param {number} coefficient
 * @param {readonly number[]} offsetsMs
 * @param {Readonly<SchedulerRecord>} [options]
 * @returns {StrikeEffect}
 */
export const strikePackets = (
  coefficient: number,
  offsetsMs: readonly number[],
  options: Readonly<SchedulerRecord> = {}
): StrikeEffect => {
  const count = Array.isArray(offsetsMs) ? offsetsMs.length : 0;
  if (count === 0) {
    throw new TypeError('Strike packet timelines require at least one offset.');
  }

  const perPacket = Number(coefficient) / count;
  return strikeTimeline(
    offsetsMs.map((atMs) => ({ atMs, coefficient: perPacket })),
    options
  );
};

/**
 * Describes a condition application, optionally with explicit timing metadata.
 *
 * @param {string} conditionName
 * @param {number} stacks
 * @param {number} duration
 * @param {number | (Readonly<SchedulerRecord> & {atMs?: number, metadata?: Readonly<SchedulerRecord>}) | null} [atMsOrOptions]
 * @param {Readonly<SchedulerRecord>} [metadata]
 * @returns {ConditionEffect}
 */
export const condition = (
  conditionName: string,
  stacks: number,
  duration: number,
  atMsOrOptions?: number | ConditionOptions | null,
  metadata?: Readonly<SchedulerRecord>
): ConditionEffect => {
  let options: ConditionOptions;
  if (atMsOrOptions && typeof atMsOrOptions === 'object' && !Array.isArray(atMsOrOptions)) {
    options = atMsOrOptions as ConditionOptions;
  } else {
    const atMs = atMsOrOptions as number | null | undefined;
    options = {
      ...(atMs == null ? {} : { atMs }),
      ...(metadata ? { metadata } : {})
    };
  }

  return {
    type: 'condition',
    condition: conditionName,
    stacks,
    duration,
    ...withoutReservedOptions(options, CONDITION_RESERVED_OPTIONS),
    ...(options.atMs == null ? {} : { atMs: options.atMs }),
    ...(options.metadata ? { metadata: options.metadata } : {})
  } as ConditionEffect;
};

/**
 * Describes an explicit condition-application timeline.
 *
 * @param {readonly ConditionTick[]} ticks
 * @param {Readonly<SchedulerRecord>} [options]
 * @returns {ConditionEffect}
 */
export const conditionTimeline = (
  ticks: readonly ConditionTick[],
  options: Readonly<SchedulerRecord> = {}
): ConditionEffect =>
  ({
    type: 'condition',
    ticks,
    ...withoutReservedOptions(options, TIMELINE_RESERVED_OPTIONS)
  }) as ConditionEffect;

/**
 * Convenience helper for evenly spaced repeated condition applications.
 *
 * @param {string} conditionName
 * @param {Readonly<SchedulerRecord> & {
 *   count: number,
 *   duration: number,
 *   firstAtMs?: number,
 *   intervalMs?: number,
 *   stacks?: number
 * }} options
 * @returns {ConditionEffect[]}
 */
export const repeatedCondition = (
  conditionName: string,
  { count, duration, firstAtMs = 0, intervalMs = 1000, stacks = 1, ...options }: RepeatedConditionOptions
): ConditionEffect[] =>
  Array.from({ length: count }, (_, index) =>
    condition(conditionName, stacks, duration, {
      ...options,
      atMs: firstAtMs + index * intervalMs
    })
  );

/**
 * Schedules a control event and carries the specific control kind in metadata.
 *
 * @param {string} [kind]
 * @param {number} [atMs]
 * @param {Readonly<SchedulerRecord> & {metadata?: Readonly<SchedulerRecord>}} [options]
 * @returns {SkillEffect}
 */
export const control = (
  kind = 'control',
  atMs?: number,
  options: Readonly<SchedulerRecord> & {
    readonly metadata?: Readonly<SchedulerRecord>;
  } = {}
): SkillEffect =>
  ({
    type: 'control',
    ...(atMs == null ? {} : { atMs }),
    ...withoutReservedOptions(options, CONTROL_RESERVED_OPTIONS),
    metadata: {
      controlKind: kind,
      ...(options.metadata || {})
    }
  }) as SkillEffect;

/**
 * Schedules a blind application at an optional offset.
 *
 * @param {number} [atMs]
 * @param {Readonly<SchedulerRecord>} [options]
 * @returns {SkillEffect}
 */
export const blind = (atMs?: number, options: Readonly<SchedulerRecord> = {}): SkillEffect =>
  ({
    type: 'blind',
    ...(atMs == null ? {} : { atMs }),
    ...withoutReservedOptions(options, TIMED_RESERVED_OPTIONS)
  }) as SkillEffect;

/**
 * Schedules a boon as a shared "buff" event for resolver-side stacking logic.
 *
 * @param {string} boonName
 * @param {number} duration
 * @param {Readonly<SchedulerRecord> & {stacks?: number}} [options]
 * @returns {StatusEffect}
 */
export const boon = (
  boonName: string,
  duration: number,
  options: Readonly<SchedulerRecord> & {
    readonly stacks?: number;
  } = {}
): StatusEffect =>
  ({
    type: 'boon',
    boon: boonName,
    duration,
    stacks: options.stacks ?? 1,
    ...withoutReservedOptions(options, STATUS_RESERVED_OPTIONS)
  }) as StatusEffect;

/**
 * Schedules a generic buff status event keyed by `kind`.
 *
 * @param {string} kind
 * @param {number} duration
 * @param {Readonly<SchedulerRecord> & {stacks?: number}} [options]
 * @returns {StatusEffect}
 */
export const buff = (
  kind: string,
  duration: number,
  options: Readonly<SchedulerRecord> & {
    readonly stacks?: number;
  } = {}
): StatusEffect =>
  ({
    type: 'buff',
    kind,
    duration,
    stacks: options.stacks ?? 1,
    ...withoutReservedOptions(options, STATUS_RESERVED_OPTIONS)
  }) as StatusEffect;

/**
 * Schedules a reporting-only timed effect that does not enter boon state.
 *
 * @param {string} kind
 * @param {number} duration
 * @param {Readonly<SchedulerRecord> & {stacks?: number}} [options]
 * @returns {StatusEffect}
 */
export const effect = (
  kind: string,
  duration: number,
  options: Readonly<SchedulerRecord> & {
    readonly stacks?: number;
  } = {}
): StatusEffect =>
  ({
    type: 'effect',
    kind,
    duration,
    stacks: options.stacks ?? 1,
    ...withoutReservedOptions(options, STATUS_RESERVED_OPTIONS)
  }) as StatusEffect;

/**
 * Emits a profession-defined event type with a custom event payload.
 *
 * @param {string} eventType
 * @param {number} [atMs]
 * @param {Readonly<SchedulerRecord>} [event]
 * @param {Readonly<SchedulerRecord>} [options]
 * @returns {CustomEffect}
 */
export const custom = (
  eventType: string,
  atMs?: number,
  event: Readonly<SchedulerRecord> = {},
  options: Readonly<SchedulerRecord> = {}
): CustomEffect =>
  ({
    type: 'custom',
    eventType,
    ...(atMs == null ? {} : { atMs }),
    event,
    ...withoutReservedOptions(options, CUSTOM_RESERVED_OPTIONS)
  }) as CustomEffect;
