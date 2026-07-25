// Declarative effect builders used by profession mechanics and canonical
// catalogs. They normalize reserved fields so declarative skill data stays
// compact while still validating cleanly in catalog assembly.

/**
 * Removes fields that are owned by a specific factory so callers can still
 * attach arbitrary metadata without clobbering canonical keys.
 */
function withoutReservedOptions(options, reserved) {
  return Object.fromEntries(
    Object.entries(options || {}).filter(
      ([key, value]) => !reserved.has(key) && value != null,
    ),
  );
}

const STRIKE_RESERVED_OPTIONS = new Set(["type", "coefficient", "hits"]);
const TIMELINE_RESERVED_OPTIONS = new Set(["type", "ticks"]);
const CONDITION_RESERVED_OPTIONS = new Set([
  "type",
  "condition",
  "stacks",
  "duration",
  "atMs",
  "metadata",
]);
const CONTROL_RESERVED_OPTIONS = new Set(["type", "atMs", "metadata"]);
const TIMED_RESERVED_OPTIONS = new Set(["type", "atMs"]);
const STATUS_RESERVED_OPTIONS = new Set([
  "type",
  "boon",
  "kind",
  "duration",
  "stacks",
]);
const CUSTOM_RESERVED_OPTIONS = new Set([
  "type",
  "eventType",
  "atMs",
  "event",
]);

/**
 * Describes one or more strike hits that share a total coefficient.
 */
export const strike = (coefficient, options = {}) => ({
  type: "strike",
  coefficient,
  hits: options.hits ?? 1,
  ...withoutReservedOptions(options, STRIKE_RESERVED_OPTIONS),
});

/**
 * Describes an explicit strike timeline where each hit owns its own timing and
 * coefficient.
 */
export const strikeTimeline = (ticks, options = {}) => ({
  type: "strike",
  ticks,
  ...withoutReservedOptions(options, TIMELINE_RESERVED_OPTIONS),
});

/**
 * Describes a condition application, optionally with explicit timing metadata.
 */
export const condition = (
  conditionName,
  stacks,
  duration,
  atMsOrOptions,
  metadata,
) => {
  const options =
    atMsOrOptions
    && typeof atMsOrOptions === "object"
    && !Array.isArray(atMsOrOptions)
      ? atMsOrOptions
      : {
          ...(atMsOrOptions == null ? {} : { atMs: atMsOrOptions }),
          ...(metadata ? { metadata } : {}),
        };
  return {
    type: "condition",
    condition: conditionName,
    stacks,
    duration,
    ...withoutReservedOptions(options, CONDITION_RESERVED_OPTIONS),
    ...(options.atMs == null ? {} : { atMs: options.atMs }),
    ...(options.metadata ? { metadata: options.metadata } : {}),
  };
};

/**
 * Describes an explicit condition-application timeline.
 */
export const conditionTimeline = (ticks, options = {}) => ({
  type: "condition",
  ticks,
  ...withoutReservedOptions(options, TIMELINE_RESERVED_OPTIONS),
});

/**
 * Convenience helper for evenly spaced repeated condition applications.
 */
export const repeatedCondition = (
  conditionName,
  {
    count,
    duration,
    firstAtMs = 0,
    intervalMs = 1000,
    stacks = 1,
    ...options
  },
) => Array.from(
  { length: count },
  (_, index) => condition(
    conditionName,
    stacks,
    duration,
    {
      ...options,
      atMs: firstAtMs + index * intervalMs,
    },
  ),
);

/**
 * Schedules a control event and carries the specific control kind in metadata.
 */
export const control = (kind = "control", atMs, options = {}) => ({
  type: "control",
  ...(atMs == null ? {} : { atMs }),
  ...withoutReservedOptions(options, CONTROL_RESERVED_OPTIONS),
  metadata: {
    controlKind: kind,
    ...(options.metadata || {}),
  },
});

/**
 * Schedules a blind application at an optional offset.
 */
export const blind = (atMs, options = {}) => ({
  type: "blind",
  ...(atMs == null ? {} : { atMs }),
  ...withoutReservedOptions(options, TIMED_RESERVED_OPTIONS),
});

/**
 * Schedules a boon as a shared "buff" event for resolver-side stacking logic.
 */
export const boon = (boonName, duration, options = {}) => ({
  type: "boon",
  boon: boonName,
  duration,
  stacks: options.stacks ?? 1,
  ...withoutReservedOptions(options, STATUS_RESERVED_OPTIONS),
});

/**
 * Schedules a generic buff status event keyed by `kind`.
 */
export const buff = (kind, duration, options = {}) => ({
  type: "buff",
  kind,
  duration,
  stacks: options.stacks ?? 1,
  ...withoutReservedOptions(options, STATUS_RESERVED_OPTIONS),
});

/**
 * Emits a profession-defined event type with a custom event payload.
 */
export const custom = (eventType, atMs, event = {}, options = {}) => ({
  type: "custom",
  eventType,
  ...(atMs == null ? {} : { atMs }),
  event,
  ...withoutReservedOptions(options, CUSTOM_RESERVED_OPTIONS),
});
