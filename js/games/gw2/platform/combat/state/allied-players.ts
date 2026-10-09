import { normalizeEffectAudience } from '#gw2/platform/effects/audience-metadata-validation.js';

import type { EffectAudience, ResolvedEffectAudience, SimulationEventBase } from '#gw2/platform/events/events.js';
import { boundedInteger, boundedNumber, clamp } from '#kernel/core/numeric.js';

/**
 * Normalized allied party assumptions. Allied strikes only exist as proc
 * triggers; they never contribute their own damage.
 */
interface Gw2AlliedPlayerAssumptions {
  readonly count: number;
  readonly strikesPerSecond: number;
}

interface Gw2AlliedPlayerConfig {
  readonly allies?: {
    readonly count?: number;
    readonly strikesPerSecond?: number;
  };
  /** Whether player boons also reach the player's own summons. */
  readonly sharePlayerBoonsWithSummons?: boolean;
}

interface Gw2BoonRecipientEvent {
  readonly type?: unknown;
  readonly actorType?: unknown;
  readonly summonOwner?: unknown;
  readonly audience?: EffectAudience;
  readonly resolvedAudience?: ResolvedEffectAudience;
}

/**
 * Normalizes the small party model used by effects that are triggered by
 * allied player strikes. The simulator owns the build user's damage; allied
 * strikes exist only as proc triggers and never contribute their own damage.
 */
export function gw2AlliedPlayerAssumptions(config: Gw2AlliedPlayerConfig = {}): Gw2AlliedPlayerAssumptions {
  const allies = config.allies || {};
  return Object.freeze({
    count: boundedInteger(allies.count || 0, 0, 0, 4),
    strikesPerSecond: boundedNumber(allies.strikesPerSecond || 0, 0, 0, 10)
  });
}

/**
 * Supplies concrete active companion candidates before canonical recipient
 * selection, including finishers whose generated Area boons resolve later.
 */
export function prepareGw2BuffCompanionCandidates(
  event: SimulationEventBase,
  companionIds: readonly unknown[]
): SimulationEventBase {
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
  // A named ally occupies one slot only when that player exists in the configured party.
  const eligiblePlayers =
    audience.alliedPlayerIndex == null ? party.count : Number(audience.alliedPlayerIndex <= party.count);
  const alliedPlayerCount =
    audience.recipients === 'party' ? clamp(limit - Number(includesSelf), 0, eligiblePlayers) : 0;
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
    ...(alliedPlayerCount && audience.alliedPlayerIndex != null
      ? { alliedPlayerIndex: audience.alliedPlayerIndex }
      : {}),
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
  const eligiblePlayers =
    audience.alliedPlayerIndex == null ? party.count : Number(audience.alliedPlayerIndex <= party.count);
  const alliedPlayerCount =
    audience.recipients === 'party' ? clamp(limit - 1 - Number(includesSelf), 0, eligiblePlayers) : 0;
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
    ...(alliedPlayerCount && audience.alliedPlayerIndex != null
      ? { alliedPlayerIndex: audience.alliedPlayerIndex }
      : {}),
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
