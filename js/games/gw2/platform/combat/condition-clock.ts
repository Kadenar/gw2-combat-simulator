/**
 * The shared condition clock pays once per second. An offset moves those payouts earlier within the second without
 * changing application lifetimes. A strike opener measures the offset from first damage. A condition opener keeps the
 * clock that paid it, so its offset counts from rotation start and DPS start moves with that first payout.
 */
export const CONDITION_TICK_OFFSET_STEP_MS = 40;

/** The largest distinct phase. One full second would repeat the zero offset. */
export const CONDITION_TICK_OFFSET_MAX_MS = 960;

/** Saved files must name an exact supported step, so imports reject other values instead of correcting them. */
export function isConditionTickOffsetMs(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= CONDITION_TICK_OFFSET_MAX_MS &&
    value % CONDITION_TICK_OFFSET_STEP_MS === 0
  );
}

/** Preferences clamp to the supported range and snap to the nearest step. Missing or invalid numbers use zero. */
export function normalizeConditionTickOffsetMs(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;

  return (
    Math.round(Math.min(CONDITION_TICK_OFFSET_MAX_MS, Math.max(0, value)) / CONDITION_TICK_OFFSET_STEP_MS) *
    CONDITION_TICK_OFFSET_STEP_MS
  );
}
