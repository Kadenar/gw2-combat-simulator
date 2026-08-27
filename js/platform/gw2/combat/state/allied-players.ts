import { clamp } from '../numeric.js';

import type { SimulationEventInput } from '../../../engine/types.js';

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
  readonly includeAlliedPlayers?: boolean;
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
  readonly alliedPlayerCount?: unknown;
  readonly recipientCount?: unknown;
  readonly boonAudienceResolved?: unknown;
  readonly buffAudienceResolved?: unknown;
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
export interface Gw2BoonApplicationRecipients extends Gw2AlliedEffectRecipients {
  readonly affectsSelf: boolean;
  readonly affectsSummons: boolean;
}

/**
 * Normalizes the small party model used by effects that are triggered by
 * allied player strikes. The simulator owns the build user's damage; allied
 * strikes exist only as proc triggers and never contribute their own damage.
 */
export function gw2AlliedPlayerAssumptions(config: Gw2AlliedPlayerConfig = {}): Gw2AlliedPlayerAssumptions {
  const allies = config.allies || {};
  return Object.freeze({
    count: clamp(Math.trunc(Number(allies.count || 0)), 0, 4),
    strikesPerSecond: clamp(Number(allies.strikesPerSecond || 0), 0, 10)
  });
}

/**
 * Supplies concrete active companion candidates before the canonical boon
 * recipient resolver applies player-first target-cap selection.
 */
export function prepareGw2BuffCompanionCandidates(
  event: SimulationEventInput,
  companionIds: readonly unknown[]
): SimulationEventInput {
  if (
    event.type !== 'buff' ||
    event.boonAudienceResolved === true ||
    event.buffAudienceResolved === true ||
    event.affectsSummons === false
  )
    return event;
  const scope = String(event.recipients || '').toLowerCase();
  const shared =
    scope === 'party' ||
    scope === 'allies' ||
    ['summon', 'summons', 'pet', 'pets', 'companions'].includes(scope) ||
    event.affectsSummons === true;
  if (!shared || Array.isArray(event.companionIds)) return event;
  return {
    ...event,
    companionIds: [...new Set(companionIds.map(String).filter(Boolean))]
  };
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
    includeAlliedPlayers = true,
    companionIds = []
  }: Gw2AlliedEffectRecipientOptions = {}
): Gw2AlliedEffectRecipients {
  const party = gw2AlliedPlayerAssumptions(config);
  const limit = Math.max(0, Math.trunc(Number(maximumRecipients || 0)));
  const includesSelf = includeSelf && limit > 0;
  const alliedPlayerCount = includeAlliedPlayers ? clamp(limit - Number(includesSelf), 0, party.count) : 0;
  const remaining = limit - Number(includesSelf) - alliedPlayerCount;
  const selectedCompanions = [...new Set(companionIds.map(String).filter(Boolean))].slice(0, remaining);
  return Object.freeze({
    includesSelf,
    alliedPlayerCount,
    companionIds: Object.freeze(selectedCompanions),
    recipientCount: Number(includesSelf) + alliedPlayerCount + selectedCompanions.length
  });
}

/**
 * Resolves a boon event's audience. Party players claim capped allied-effect
 * slots before companions, and the summon-sharing config only controls whether
 * companions may compete for slots that remain. Summon-only effects bypass
 * both that config and allied-player selection.
 */
export function gw2BoonApplicationRecipients(
  config: Gw2AlliedPlayerConfig,
  event: Gw2BoonRecipientEvent = {}
): Gw2BoonApplicationRecipients {
  if (event.boonAudienceResolved === true) {
    const companionIds = Array.isArray(event.companionIds)
      ? [...new Set(event.companionIds.map(String).filter(Boolean))]
      : [];
    return Object.freeze({
      includesSelf: event.affectsSelf === true,
      affectsSelf: event.affectsSelf === true,
      alliedPlayerCount: Math.max(0, Math.trunc(Number(event.alliedPlayerCount || 0))),
      companionIds: Object.freeze(companionIds),
      affectsSummons: event.affectsSummons === true,
      recipientCount: Math.max(0, Math.trunc(Number(event.recipientCount || 0)))
    });
  }

  const scope = String(event.recipients || '').toLowerCase();
  const summonOnly = ['summon', 'summons', 'pet', 'pets', 'companions'].includes(scope);
  const hasCompanionIds = Array.isArray(event.companionIds);
  const explicitCompanionIds = hasCompanionIds ? [...new Set(event.companionIds.map(String).filter(Boolean))] : [];
  const shared =
    scope === 'party' ||
    scope === 'allies' ||
    summonOnly ||
    event.affectsSummons === true ||
    explicitCompanionIds.length > 0;
  const includesSelf = !summonOnly && event.affectsSelf !== false && scope !== 'allies';

  if (!shared || scope === 'self') {
    const selectedSelf = includesSelf;
    return Object.freeze({
      includesSelf: selectedSelf,
      affectsSelf: selectedSelf,
      alliedPlayerCount: 0,
      companionIds: Object.freeze([]),
      affectsSummons: false,
      recipientCount: Number(selectedSelf)
    });
  }

  const cappedAllyEffect = scope === 'party' || scope === 'allies';
  const summonsEligible = summonOnly
    ? true
    : cappedAllyEffect
      ? event.affectsSummons !== false && config.sharePlayerBoonsWithSummons !== false
      : event.affectsSummons === true || explicitCompanionIds.length > 0;
  // The sentinel reserves one logical summon slot when the event exposes only
  // boolean summon eligibility. It is never exposed as a concrete recipient.
  const genericSummonId = '__generic-summon__';
  const candidates = summonsEligible ? (hasCompanionIds ? explicitCompanionIds : [genericSummonId]) : [];
  const maximumRecipients = event.maximumRecipients ?? event.targetCap ?? 5;
  const selected = gw2AlliedEffectRecipients(config, {
    maximumRecipients: Number(maximumRecipients),
    includeSelf: includesSelf,
    includeAlliedPlayers: cappedAllyEffect,
    companionIds: candidates
  });
  const genericSummonSelected = selected.companionIds.includes(genericSummonId);
  const companionIds = genericSummonSelected ? [] : [...selected.companionIds];
  return Object.freeze({
    includesSelf: selected.includesSelf,
    affectsSelf: selected.includesSelf,
    alliedPlayerCount: selected.alliedPlayerCount,
    companionIds: Object.freeze(companionIds),
    affectsSummons: genericSummonSelected || selected.companionIds.length > 0,
    // Unknown summon identities cannot be counted accurately. Concrete ids
    // are counted; generic eligibility reserves one logical summon slot.
    recipientCount:
      Number(selected.includesSelf) + selected.alliedPlayerCount + companionIds.length + Number(genericSummonSelected)
  });
}

/**
 * Resolves generic timed-buff recipients without consulting the configuration
 * that controls whether player boons may be shared with summons.
 */
export function gw2BuffApplicationRecipients(
  config: Gw2AlliedPlayerConfig,
  event: Gw2BoonRecipientEvent = {}
): Gw2BoonApplicationRecipients {
  if (event.buffAudienceResolved === true) {
    return gw2BoonApplicationRecipients(config, {
      ...event,
      boonAudienceResolved: true
    });
  }

  return gw2BoonApplicationRecipients(
    {
      ...config,
      sharePlayerBoonsWithSummons: true
    },
    event
  );
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
    internalCooldown = 0
  }: Gw2AlliedPlayerProcOptions
): Gw2AlliedPlayerProc[] {
  const assumptions = gw2AlliedPlayerAssumptions(config);
  const allyCount = clamp(Math.trunc(Number(maximumAllies)), 0, assumptions.count);
  if (!allyCount || !assumptions.strikesPerSecond) return [];
  const interval = Math.max(Number(internalCooldown || 0), 1 / assumptions.strikesPerSecond);
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

  return events.sort((left, right) => left.at - right.at || left.allyIndex - right.allyIndex);
}
