import {
  balanceProfileFromContext,
  balanceProfileValue,
  balanceProfileValueFromContext
} from '#gw2/platform/combat/state/balance-profiles.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { advanceEnduranceIntervals, enduranceIntervalsReadyAt } from '#gw2/platform/combat/resources/endurance.js';
import { selfBoonIntervals } from '#gw2/platform/combat/state/boon-extensions.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type { RangerCastContext, RangerSchedulerContext } from '#gw2/professions/ranger/types.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/core/profiles.js';

/** Reads this invocation's profiles once; only Vigor presence changes while traversing its recovery windows. */
function rangerEnduranceRegenerationRates(context: RangerSchedulerContext) {
  const resources = balanceProfileFromContext(context, PROFILE.resources);
  const regeneration = balanceProfileValue(resources, 'enduranceRegenerationPerSecond', 5);
  const vigorMultiplier = balanceProfileValue(resources, 'vigorRegenerationMultiplier', 1.5);
  const naturalVigor = hasTrait({ config: context.config }, TRAIT.NATURAL_VIGOR)
    ? balanceProfileValueFromContext(context, PROFILE.naturalVigor, 'vigorRegenerationMultiplier', 0.25)
    : 0;
  return {
    base: regeneration * (1 + naturalVigor),
    vigor: regeneration * (1 + (vigorMultiplier - 1) + naturalVigor)
  };
}

/** Maps shared Vigor windows to invocation-local Ranger rates for both advancement and readiness. */
function* enduranceIntervals(context: RangerSchedulerContext, start: number, end: number) {
  const rates = rangerEnduranceRegenerationRates(context);
  for (const interval of selfBoonIntervals(context.events, 'vigor', start, end, Boolean(context.config.boons?.vigor))) {
    yield { start: interval.start, end: interval.end, rate: interval.active ? rates.vigor : rates.base };
  }
}

export function advanceRangerResources(context: RangerSchedulerContext, target: number): void {
  const state = professionCoreState(context);
  const from = Number(state.enduranceUpdatedAt || 0);
  if (target <= from) return;
  // Integrate each actual Vigor window so splitting a wait cannot alter regeneration.
  Object.assign(
    state,
    advanceEnduranceIntervals(state, enduranceIntervals(context, from, target), state.maximumEndurance)
  );
}

export function rangerEnduranceReadyAt(context: RangerCastContext, cost: number): number | null {
  // Predict the same integrated recovery used by advancement, including future Vigor expiry.
  const state = professionCoreState(context);
  return enduranceIntervalsReadyAt(
    { endurance: state.endurance, enduranceUpdatedAt: context.start },
    cost,
    enduranceIntervals(context, context.start, Infinity),
    state.maximumEndurance,
    context.epsilon
  );
}
