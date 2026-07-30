/**
 * Normalized allied party assumptions. Allied strikes only exist as proc
 * triggers; they never contribute their own damage.
 */
export interface Gw2AlliedPlayerAssumptions {
  readonly count: number;
  readonly strikesPerSecond: number;
}

interface Gw2AlliedPlayerConfig {
  readonly allies?: {
    readonly count?: number;
    readonly strikesPerSecond?: number;
  };
  readonly [field: string]: unknown;
}

interface Gw2AlliedPlayerProcOptions {
  readonly start: number;
  readonly duration?: number;
  readonly maximumPerAlly?: number;
  readonly internalCooldown?: number;
}

/**
 * One deterministic allied strike opportunity within a buff window.
 */
export interface Gw2AlliedPlayerProc {
  readonly allyIndex: number;
  readonly procIndex: number;
  readonly at: number;
}

/**
 * Normalizes the small party model used by effects that are triggered by
 * allied player strikes. The simulator owns the build user's damage; allied
 * strikes exist only as proc triggers and never contribute their own damage.
 */
export function gw2AlliedPlayerAssumptions(
  config: Gw2AlliedPlayerConfig = {},
): Gw2AlliedPlayerAssumptions {
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
  config: Gw2AlliedPlayerConfig,
  {
    start,
    duration,
    maximumPerAlly = Number.POSITIVE_INFINITY,
    internalCooldown = 0,
  }: Gw2AlliedPlayerProcOptions,
): Gw2AlliedPlayerProc[] {
  const assumptions = gw2AlliedPlayerAssumptions(config);
  if (!assumptions.count || !assumptions.strikesPerSecond) return [];
  const interval = Math.max(
    Number(internalCooldown || 0),
    1 / assumptions.strikesPerSecond,
  );
  const end = Number(start) + Math.max(0, Number(duration || 0));
  const limit = Math.max(0, Math.trunc(Number(maximumPerAlly)));
  const events: Gw2AlliedPlayerProc[] = [];
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
