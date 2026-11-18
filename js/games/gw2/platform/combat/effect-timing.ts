import { gw2Time } from '#gw2/platform/combat/clock.js';
import { roundHalfToEven } from '#kernel/core/numeric.js';

/** Expires temporary effects on the next absolute action tick without changing their stored duration. */
export function gw2EffectExpiresAt(at: number, duration: number): number {
  const appliedAt = gw2Time(at);

  if (!(duration > 0)) return appliedAt;

  return gw2Time(appliedAt + duration);
}

/** Private timers store zero for an absent window, so a zero-duration grant never reads as live. */
export function gw2TimerDeadline(at: number, duration: number): number {
  return duration > 0 ? gw2EffectExpiresAt(at, duration) : 0;
}

/** Final effect durations use half-even whole milliseconds; expiration stays relative to the application time. */
export function roundEffectDuration(duration: number): number {
  if (!Number.isFinite(duration)) throw new RangeError('Effect duration must be finite.');

  return roundHalfToEven(Math.max(0, duration) * 1000) / 1000;
}
