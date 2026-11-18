/** GW2 rounds runtime timestamps forward to its 40 ms grid; the kernel retains game-neutral precision. */
import { canonicalInterval, canonicalTime, timeKey } from '#kernel/core/clock.js';
import { canonicalEvent, type QueuedEvent } from '#kernel/events/queue.js';

export const GW2_TICK_MS = 40;

/** Normalize arithmetic noise before rounding so an exact boundary never advances another tick. */
export function gw2Time(seconds: number): number {
  if (seconds === Infinity || seconds === -Infinity) return seconds;

  const tick = GW2_TICK_MS * 1000;
  return canonicalTime((Math.ceil(timeKey(seconds) / tick) * tick) / 1_000_000);
}

/** Recurring intervals must advance at least one GW2 tick. */
export function gw2Interval(seconds: number): number {
  return gw2Time(canonicalInterval(seconds));
}

/** Queued and synchronous packets receive the same game timestamp before either can affect state. */
export function gw2Event<T extends QueuedEvent>(event: T): T {
  const validated = canonicalEvent(event);
  const at = gw2Time(validated.at);
  return validated.at === at ? validated : { ...validated, at };
}
