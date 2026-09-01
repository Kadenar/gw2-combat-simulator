import { clamp } from '#gw2/platform/combat/numeric.js';
import { normalizeEffectAudience } from '#gw2/platform/engine/effects/contracts.js';

import type { EffectAudience, ResolvedEffectAudience, SimulationEventInput } from '#gw2/platform/engine/types.js';

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

interface Gw2BoonRecipientEvent {
  readonly type?: unknown;
  readonly actorType?: unknown;
  readonly summonOwner?: unknown;
  readonly audience?: EffectAudience;
  readonly resolvedAudience?: ResolvedEffectAudience;
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
export type Gw2AlliedEffectRecipients = ResolvedEffectAudience;

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
 * Supplies concrete active companion candidates before canonical recipient
 * selection, including finishers whose generated Area boons resolve later.
 */
export function prepareGw2BuffCompanionCandidates(
  event: SimulationEventInput,
  companionIds: readonly unknown[]
): SimulationEventInput {
  const candidates = [...new Set(companionIds.map(String).filter(Boolean))];
  if (event.type === 'combo_finisher') return { ...event, companionCandidates: candidates };
  if (event.type !== 'buff' || event.resolvedAudience || !event.audience) return event;
  const audience = normalizeEffectAudience(event.audience)!;
  if (audience.recipients === 'self' || audience.eligibleCompanionIds) return event;
  return {
    ...event,
    audience: {
      ...audience,
      eligibleCompanionIds: candidates
    }
  };
}

/**
 * Selects recipients for a capped allied effect. The simulated player normally
 * claims the first slot; affectsSelf false leaves that slot available to allies.
 */
export function gw2AlliedEffectRecipients(
  config: Gw2AlliedPlayerConfig,
  request: EffectAudience = { recipients: 'party' }
): ResolvedEffectAudience {
  const audience = normalizeEffectAudience(request)!;
  const party = gw2AlliedPlayerAssumptions(config);
  const shared = audience.recipients !== 'self';
  const limit = audience.maximumRecipients ?? (shared ? 5 : 1);
  const includesSelf = audience.affectsSelf !== false;
  const alliedPlayerCount = audience.recipients === 'party' ? clamp(limit - Number(includesSelf), 0, party.count) : 0;
  const remaining = limit - Number(includesSelf) - alliedPlayerCount;
  const summonsEligible =
    audience.recipients === 'summons' ||
    (audience.recipients === 'party' && config.sharePlayerBoonsWithSummons !== false);
  const selectedCompanions = summonsEligible
    ? [...new Set((audience.eligibleCompanionIds || []).map(String).filter(Boolean))].slice(0, remaining)
    : [];
  return Object.freeze({
    includesSelf,
    includesSummons: selectedCompanions.length > 0,
    alliedPlayerCount,
    companionIds: Object.freeze(selectedCompanions),
    recipientCount: Number(includesSelf) + alliedPlayerCount + selectedCompanions.length
  });
}

/**
 * Resolves a boon event's audience. Party players claim capped allied-effect
 * slots before companions, while affectsSelf can exclude the simulated player.
 * Summon-only effects bypass allied-player selection and boon-sharing policy.
 */
export function gw2BoonApplicationRecipients(
  config: Gw2AlliedPlayerConfig,
  event: Gw2BoonRecipientEvent = {}
): ResolvedEffectAudience {
  if (event.resolvedAudience) return event.resolvedAudience;
  const audience = normalizeEffectAudience(event.audience ?? { recipients: 'self' })!;
  if (event.actorType !== 'summon') return gw2AlliedEffectRecipients(config, audience);

  // A summon-cast effect always includes that summon, while the controlled
  // player is selected only by a party scope with room beyond the caster.
  const party = gw2AlliedPlayerAssumptions(config);
  const shared = audience.recipients !== 'self';
  const limit = audience.maximumRecipients ?? (shared ? 5 : 1);
  const includesSelf = audience.recipients === 'party' && audience.affectsSelf !== false && limit > 1;
  const alliedPlayerCount =
    audience.recipients === 'party' ? clamp(limit - 1 - Number(includesSelf), 0, party.count) : 0;
  const remaining = limit - 1 - Number(includesSelf) - alliedPlayerCount;
  const casterId = String(event.summonOwner || '');
  const candidates = [...new Set((audience.eligibleCompanionIds || []).map(String).filter(Boolean))].filter(
    (id) => id !== casterId
  );
  const summonsEligible =
    audience.recipients === 'summons' ||
    (audience.recipients === 'party' && config.sharePlayerBoonsWithSummons !== false);
  const selectedCompanions = summonsEligible ? candidates.slice(0, remaining) : [];
  return Object.freeze({
    includesSelf,
    includesSummons: true,
    alliedPlayerCount,
    companionIds: Object.freeze(casterId ? [casterId, ...selectedCompanions] : selectedCompanions),
    recipientCount: 1 + Number(includesSelf) + alliedPlayerCount + selectedCompanions.length
  });
}

/** Resolves non-boon buffs without applying the player-boon summon-sharing toggle. */
export function gw2BuffApplicationRecipients(
  config: Gw2AlliedPlayerConfig,
  event: Gw2BoonRecipientEvent = {}
): ResolvedEffectAudience {
  return gw2BoonApplicationRecipients({ ...config, sharePlayerBoonsWithSummons: true }, event);
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
