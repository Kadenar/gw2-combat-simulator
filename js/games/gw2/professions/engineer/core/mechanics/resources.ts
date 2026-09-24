import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitEngineerStateSnapshot } from '#gw2/professions/engineer/family-state.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  advanceEnduranceIntervals,
  enduranceIntervalsReadyAt,
  vigorEnduranceIntervals
} from '#gw2/platform/combat/resources/endurance.js';
import { ENGINEER_CORE_BALANCE_PROFILE_IDS } from '#gw2/professions/engineer/core/profiles.js';
import type { EngineerSchedulerContext } from '#gw2/professions/engineer/types.js';

/** Calculates an interval's endurance rate after Vigor and Adrenal Implant modifiers. */
function engineerEnduranceRegenerationRate(context: EngineerSchedulerContext, vigor: boolean): number {
  const resourcesProfile = requireBalanceProfileFromContext(context, ENGINEER_CORE_BALANCE_PROFILE_IDS.resources);
  const multiplier =
    1 +
    (vigor ? balanceProfileNumber(resourcesProfile, 'vigorRegenerationMultiplier') - 1 : 0) +
    (hasTrait(context.config, TRAIT.ADRENAL_IMPLANT)
      ? balanceProfileNumber(resourcesProfile, 'coefficientMultiplier') - 1
      : 0);
  return balanceProfileNumber(resourcesProfile, 'enduranceRegenerationPerSecond') * multiplier;
}

/** Maps shared, cancellation-aware self-Vigor windows to local rates for both recovery and dodge readiness. */
function enduranceIntervals(context: EngineerSchedulerContext, start: number, end: number) {
  const baseRate = engineerEnduranceRegenerationRate(context, false);
  const vigorRate = engineerEnduranceRegenerationRate(context, true);
  return vigorEnduranceIntervals(context, start, end, (vigor) => (vigor ? vigorRate : baseRate));
}

/** Predicts the first affordable dodge across known Vigor windows, including recovery after expiry. */
export function engineerEnduranceReadyAt(
  context: EngineerSchedulerContext & { readonly start: number },
  cost: number
): number | null {
  const state = professionCoreState(context);
  return enduranceIntervalsReadyAt(
    { endurance: Number(state.endurance || 0), enduranceUpdatedAt: context.start },
    cost,
    enduranceIntervals(context, context.start, Infinity),
    Number(
      state.maximumEndurance ||
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, ENGINEER_CORE_BALANCE_PROFILE_IDS.resources),
          'maximumStacks'
        )
    )
  );
}

/** Advances Core endurance to a target time and emits the updated Engineer state. */
export function advanceEngineerResources(context: EngineerSchedulerContext, target: number): void {
  const state = professionCoreState(context);
  const from = Number(state.enduranceUpdatedAt || 0);
  if (target <= from) return;
  const maximum = Number(
    state.maximumEndurance ||
      balanceProfileNumber(
        requireBalanceProfileFromContext(context, ENGINEER_CORE_BALANCE_PROFILE_IDS.resources),
        'maximumStacks'
      )
  );
  Object.assign(state, advanceEnduranceIntervals(state, enduranceIntervals(context, from, target), maximum));

  emitEngineerStateSnapshot(context, target, 'resources');
}
