/** GW2 completes calculated cast durations on 40 ms action-tick boundaries. */
export const GW2_ACTION_TICK_MS = 40;

/** Rounds a positive duration up to the next server/action interval. */
export function quantizeGw2ActionDurationUp(value: number, interval = GW2_ACTION_TICK_MS): number {
  if (!(value > 0)) return 0;
  // The epsilon keeps an exact boundary from rounding into the next action tick.
  return Math.ceil(value / interval - 1e-9) * interval;
}
