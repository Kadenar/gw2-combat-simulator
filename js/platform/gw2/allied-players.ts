import { clamp } from "./numeric.js";

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

interface Gw2BoonRecipientEvent {
  readonly type?: unknown;
  readonly recipients?: unknown;
  readonly affectsSelf?: unknown;
  readonly affectsSummons?: unknown;
  readonly maximumRecipients?: unknown;
  readonly targetCap?: unknown;
  readonly companionIds?: readonly unknown[];
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

/** Canonical audience metadata attached to every resolved boon application. */
export interface Gw2BoonApplicationRecipients
  extends Gw2AlliedEffectRecipients {
  readonly affectsSelf: boolean;
  readonly affectsSummons: boolean;
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
    count: clamp(Math.trunc(Number(allies.count || 0)), 0, 4),
    strikesPerSecond: clamp(Number(allies.strikesPerSecond || 0), 0, 10),
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
  const alliedPlayerCount = clamp(
    limit - Number(includesSelf),
    0,
    party.count,
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
 * Resolves a boon event's capped audience. Explicit allied-player assumptions
 * claim slots before profession-owned companions. A generic `affectsSummons`
 * event retains boolean summon eligibility when concrete companion ids are not
 * available, while still losing that eligibility when players fill the cap.
 */
export function gw2BoonApplicationRecipients(
  config: Gw2AlliedPlayerConfig,
  event: Gw2BoonRecipientEvent = {},
): Gw2BoonApplicationRecipients {
  const scope = String(event.recipients || "").toLowerCase();
  const explicitCompanionIds = Array.isArray(event.companionIds)
    ? [...new Set(event.companionIds.map(String).filter(Boolean))]
    : [];
  const shared =
    scope === "party" ||
    scope === "allies" ||
    event.affectsSummons === true ||
    explicitCompanionIds.length > 0;
  const includesSelf =
    event.affectsSelf !== false && scope !== "allies";

  if (!shared || scope === "self") {
    const selectedSelf = includesSelf;
    return Object.freeze({
      includesSelf: selectedSelf,
      affectsSelf: selectedSelf,
      alliedPlayerCount: 0,
      companionIds: Object.freeze([]),
      affectsSummons: false,
      recipientCount: Number(selectedSelf),
    });
  }

  const hasSummonOverride = Object.hasOwn(event, "affectsSummons");
  const summonsEligible =
    event.affectsSummons === true ||
    (!hasSummonOverride && explicitCompanionIds.length > 0) ||
    (!hasSummonOverride && config.sharePlayerBoonsWithSummons !== false);
  // The sentinel reserves one logical summon slot when the event exposes only
  // boolean summon eligibility. It is never exposed as a concrete recipient.
  const genericSummonId = "__generic-summon__";
  const candidates = summonsEligible
    ? explicitCompanionIds.length > 0
      ? explicitCompanionIds
      : [genericSummonId]
    : [];
  const maximumRecipients =
    event.maximumRecipients ?? event.targetCap ?? 5;
  const selected = gw2AlliedEffectRecipients(config, {
    maximumRecipients: Number(maximumRecipients),
    includeSelf: includesSelf,
    companionIds: candidates,
  });
  const genericSummonSelected =
    selected.companionIds.includes(genericSummonId);
  const companionIds = genericSummonSelected
    ? []
    : [...selected.companionIds];
  return Object.freeze({
    includesSelf: selected.includesSelf,
    affectsSelf: selected.includesSelf,
    alliedPlayerCount: selected.alliedPlayerCount,
    companionIds: Object.freeze(companionIds),
    affectsSummons:
      genericSummonSelected || selected.companionIds.length > 0,
    // Unknown summon identities cannot be counted accurately. Concrete ids
    // are counted; generic eligibility remains represented by affectsSummons.
    recipientCount:
      Number(selected.includesSelf) +
      selected.alliedPlayerCount +
      companionIds.length,
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
  const allyCount = clamp(
    Math.trunc(Number(maximumAllies)),
    0,
    assumptions.count,
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
