/**
 * Normalizes the small party model used by effects that are triggered by
 * allied player strikes. The simulator owns the build user's damage; allied
 * strikes exist only as proc triggers and never contribute their own damage.
 */
export function gw2AlliedPlayerAssumptions(config = {}) {
  const allies = config.allies || {};
  return Object.freeze({
    count: Math.max(0, Math.min(4, Math.trunc(Number(allies.count || 0)))),
    strikesPerSecond: Math.max(
      0,
      Math.min(10, Number(allies.strikesPerSecond || 0)),
    ),
  });
}

/**
 * Materializes deterministic allied strike opportunities within a buff window.
 * A per-player ICD caps the effective trigger rate.
 */
export function gw2AlliedPlayerProcTimeline(
  config,
  {
    start,
    duration,
    maximumPerAlly = Number.POSITIVE_INFINITY,
    internalCooldown = 0,
  },
) {
  const assumptions = gw2AlliedPlayerAssumptions(config);
  if (!assumptions.count || !assumptions.strikesPerSecond) return [];
  const interval = Math.max(
    Number(internalCooldown || 0),
    1 / assumptions.strikesPerSecond,
  );
  const end = Number(start) + Math.max(0, Number(duration || 0));
  const limit = Math.max(0, Math.trunc(Number(maximumPerAlly)));
  const events = [];
  for (let allyIndex = 1; allyIndex <= assumptions.count; allyIndex += 1) {
    for (
      let procIndex = 1, at = Number(start) + interval;
      procIndex <= limit && at < end + 1e-9;
      procIndex += 1, at += interval
    ) {
      events.push({ allyIndex, procIndex, at });
    }
  }
  return events.sort(
    (left, right) => left.at - right.at || left.allyIndex - right.allyIndex,
  );
}
