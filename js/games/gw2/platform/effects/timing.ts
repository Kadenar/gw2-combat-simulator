import { quantizeGw2ActionDurationUp } from '#gw2/platform/combat/action-tick.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { roundHalfToEven } from '#kernel/core/numeric.js';

/** Expires temporary effects on the next absolute action tick without changing their stored duration. */
export function gw2EffectExpiresAt(at: number, duration: number): number {
  const appliedAt = canonicalTime(at);
  if (!(duration > 0)) return appliedAt;
  return canonicalTime(quantizeGw2ActionDurationUp((appliedAt + duration) * 1000) / 1000);
}

/** Final effect durations use half-even whole milliseconds; expiration stays relative to the application time. */
export function roundEffectDuration(duration: number): number {
  if (!Number.isFinite(duration)) throw new RangeError('Effect duration must be finite.');
  return roundHalfToEven(Math.max(0, duration) * 1000) / 1000;
}
