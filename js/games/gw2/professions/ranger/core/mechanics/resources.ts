import {
  balanceProfileFromContext,
  balanceProfileValue,
  balanceProfileValueFromContext
} from '#gw2/platform/combat/state/balance-profiles.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { advanceEndurance, enduranceReadyAt } from '#gw2/platform/combat/resources/endurance.js';
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

export function advanceRangerResources(context: RangerSchedulerContext, target: number): void {
  const state = professionCoreState(context);
  const from = Number(state.enduranceUpdatedAt || 0);
  if (target <= from) return;
  const rates = rangerEnduranceRegenerationRates(context);
  // Integrate each actual Vigor window so splitting a wait cannot alter regeneration.
  for (const interval of selfBoonIntervals(context.events, 'vigor', from, target, Boolean(context.config.boons?.vigor)))
    Object.assign(
      state,
      advanceEndurance(state, interval.end, interval.active ? rates.vigor : rates.base, state.maximumEndurance)
    );
}

export function rangerEnduranceReadyAt(context: RangerCastContext, cost: number): number | null {
  // Predict the same integrated recovery used by advancement, including future Vigor expiry.
  let endurance = professionCoreState(context).endurance;
  const rates = rangerEnduranceRegenerationRates(context);
  for (const interval of selfBoonIntervals(
    context.events,
    'vigor',
    context.start,
    Infinity,
    Boolean(context.config.boons?.vigor)
  )) {
    const rate = interval.active ? rates.vigor : rates.base;
    const readyAt = enduranceReadyAt(endurance, cost, interval.start, rate, context.epsilon);
    if (readyAt != null && readyAt <= interval.end) return readyAt;
    endurance += (interval.end - interval.start) * rate;
  }

  return null;
}
