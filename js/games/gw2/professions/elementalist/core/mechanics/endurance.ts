/**
 * Owns Elementalist-specific endurance regeneration policy.
 * Shared capped resource arithmetic stays in the platform endurance primitive.
 */
import { balanceProfileValueFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import type { ElementalistSchedulerContext } from '#gw2/professions/elementalist/types.js';
import type { ElementalistCoreState } from '#gw2/professions/elementalist/core/state.js';
import { ENDURANCE_PER_SECOND } from '#gw2/professions/elementalist/core/constants.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profiles.js';
import { advanceEndurance, enduranceReadyAt } from '#gw2/platform/combat/resources/endurance.js';
import { boonApplicationsAt } from '#gw2/platform/combat/state/boon-extensions.js';
import {
  buffMatchesAudience,
  durationStackingBoonCapSeconds,
  remainingDurationStackSeconds
} from '#gw2/platform/combat/state/boons.js';

/** Resolves Elementalist's profile-aware endurance rate while leaving shared arithmetic to the GW2 primitive. */
export function elementalistEnduranceRegenerationRate(context: ElementalistSchedulerContext, vigor: boolean): number {
  const regeneration = balanceProfileValueFromContext(
    context,
    PROFILE.resources,
    'enduranceRegenerationPerSecond',
    ENDURANCE_PER_SECOND
  );
  const vigorMultiplier = balanceProfileValueFromContext(
    context,
    PROFILE.resources,
    'vigorRegenerationMultiplier',
    1.5
  );
  return regeneration * (vigor ? vigorMultiplier : 1);
}

/** Splits recovery at self-Vigor applications and pooled expiry so waits and dodge retries use identical rates. */
function* enduranceIntervals(context: ElementalistSchedulerContext, start: number, end: number) {
  const baseRate = elementalistEnduranceRegenerationRate(context, false);
  const vigorRate = elementalistEnduranceRegenerationRate(context, true);
  if (context.config.boons?.vigor) {
    yield { end, rate: vigorRate };
    return;
  }

  const applications = boonApplicationsAt(context.events, 'vigor', Infinity).filter((application) =>
    buffMatchesAudience(application, 'all')
  );
  const boundaries = [
    ...new Set(applications.map((event) => event.at).filter((at) => at > start && at < end)),
    end
  ].sort((left, right) => left - right);
  for (const boundary of boundaries) {
    // ponytail: replays the small Vigor history per boundary; cache duration windows if long rotations make this costly.
    const remaining = remainingDurationStackSeconds(applications, start, {
      maximum: durationStackingBoonCapSeconds('vigor')
    });
    const vigorEnd = Math.min(boundary, start + remaining);
    if (vigorEnd > start) yield { end: vigorEnd, rate: vigorRate };
    if (boundary > vigorEnd) yield { end: boundary, rate: baseRate };
    start = boundary;
  }
}

/** Advances capped endurance across each rate interval without rewinding an already settled timestamp. */
export function updateEndurance(context: ElementalistSchedulerContext, state: ElementalistCoreState, at: number): void {
  if (at <= state.enduranceUpdatedAt) return;

  const maximum = balanceProfileValueFromContext(context, PROFILE.resources, 'maximumStacks', 100);
  for (const interval of enduranceIntervals(context, state.enduranceUpdatedAt, at)) {
    Object.assign(state, advanceEndurance(state, interval.end, interval.rate, maximum));
  }
}

/** Projects the first affordable dodge across known Vigor windows, including recovery after expiry. */
export function elementalistEnduranceReadyAt(
  context: ElementalistSchedulerContext,
  current: number,
  cost: number,
  at: number
): number | null {
  for (const interval of enduranceIntervals(context, at, Infinity)) {
    const readyAt = enduranceReadyAt(current, cost, at, interval.rate, context.epsilon);
    if (readyAt != null && readyAt <= interval.end) return readyAt;
    current += (interval.end - at) * Math.max(0, interval.rate);
    at = interval.end;
  }

  return null;
}
