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
  readonly maximumAllies?: number;
  readonly maximumPerAlly?: number;
  readonly internalCooldown?: number;
}

interface Gw2AlliedEffectRecipientOptions {
  readonly maximumRecipients?: number;
  readonly includeSelf?: boolean;
  readonly companionIds?: readonly string[];
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
 * Target selection for a party effect that may also affect pets, minions, or
 * other profession-owned companions. Player party members take priority over
 * companions, matching GW2's allied-target priority.
 */
export interface Gw2AlliedEffectRecipients {
  readonly includesSelf: boolean;
  readonly alliedPlayerCount: number;
  readonly companionIds: readonly string[];
  readonly recipientCount: number;
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
 * Selects recipients for a capped allied effect. The returned companion list
 * contains only companions that fit after the caster and configured allied
 * players have claimed their higher-priority slots.
 */
export function gw2AlliedEffectRecipients(
  config: Gw2AlliedPlayerConfig,
  {
    maximumRecipients = 5,
    includeSelf = true,
    companionIds = [],
  }: Gw2AlliedEffectRecipientOptions = {},
): Gw2AlliedEffectRecipients {
  const party = gw2AlliedPlayerAssumptions(config);
  const limit = Math.max(0, Math.trunc(Number(maximumRecipients || 0)));
  const includesSelf = includeSelf && limit > 0;
  const alliedPlayerCount = Math.min(
    party.count,
    Math.max(0, limit - Number(includesSelf)),
  );
  const remaining =
    limit - Number(includesSelf) - alliedPlayerCount;
  const selectedCompanions = [
    ...new Set(companionIds.map(String).filter(Boolean)),
  ].slice(0, remaining);
  return Object.freeze({
    includesSelf,
    alliedPlayerCount,
    companionIds: Object.freeze(selectedCompanions),
    recipientCount:
      Number(includesSelf) + alliedPlayerCount + selectedCompanions.length,
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
    maximumAllies = Number.POSITIVE_INFINITY,
    maximumPerAlly = Number.POSITIVE_INFINITY,
    internalCooldown = 0,
  }: Gw2AlliedPlayerProcOptions,
): Gw2AlliedPlayerProc[] {
  const assumptions = gw2AlliedPlayerAssumptions(config);
  const allyCount = Math.min(
    assumptions.count,
    Math.max(0, Math.trunc(Number(maximumAllies))),
  );
  if (!allyCount || !assumptions.strikesPerSecond) return [];
  const interval = Math.max(
    Number(internalCooldown || 0),
    1 / assumptions.strikesPerSecond,
  );
  const end = Number(start) + Math.max(0, Number(duration || 0));
  const limit = Math.max(0, Math.trunc(Number(maximumPerAlly)));
  const events: Gw2AlliedPlayerProc[] = [];
  for (let allyIndex = 1; allyIndex <= allyCount; allyIndex += 1) {
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
