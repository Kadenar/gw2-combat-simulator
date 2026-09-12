import { balanceProfileValueFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitEngineerStateSnapshot } from '#gw2/professions/engineer/state.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { advanceEndurance, enduranceReadyAt } from '#gw2/platform/combat/resources/endurance.js';
import { selfBoonIntervals } from '#gw2/platform/combat/state/boon-extensions.js';
import { ENGINEER_CORE_BALANCE_PROFILE_IDS } from '#gw2/professions/engineer/core/profiles.js';
import type { EngineerSchedulerContext } from '#gw2/professions/engineer/types.js';

/** Calculates an interval's endurance rate after Vigor and Adrenal Implant modifiers. */
export function engineerEnduranceRegenerationRate(context: EngineerSchedulerContext, vigor: boolean): number {
  const multiplier =
    1 +
    (vigor
      ? balanceProfileValueFromContext(
          context,
          ENGINEER_CORE_BALANCE_PROFILE_IDS.resources,
          'vigorRegenerationMultiplier',
          1.5
        ) - 1
      : 0) +
    (hasTrait(context.config, TRAIT.ADRENAL_IMPLANT)
      ? balanceProfileValueFromContext(
          context,
          ENGINEER_CORE_BALANCE_PROFILE_IDS.resources,
          'coefficientMultiplier',
          1.25
        ) - 1
      : 0);
  return (
    balanceProfileValueFromContext(
      context,
      ENGINEER_CORE_BALANCE_PROFILE_IDS.resources,
      'enduranceRegenerationPerSecond',
      5
    ) * multiplier
  );
}

/** Maps shared, cancellation-aware self-Vigor windows to local rates for both recovery and dodge readiness. */
function* enduranceIntervals(context: EngineerSchedulerContext, start: number, end: number) {
  const baseRate = engineerEnduranceRegenerationRate(context, false);
  const vigorRate = engineerEnduranceRegenerationRate(context, true);
  for (const interval of selfBoonIntervals(context.events, 'vigor', start, end, Boolean(context.config.boons?.vigor))) {
    yield { end: interval.end, rate: interval.active ? vigorRate : baseRate };
  }
}

/** Predicts the first affordable dodge across known Vigor windows, including recovery after expiry. */
export function engineerEnduranceReadyAt(
  context: EngineerSchedulerContext & { readonly start: number },
  cost: number
): number | null {
  let current = Number(professionCoreState(context).endurance || 0);
  let at = context.start;
  for (const interval of enduranceIntervals(context, at, Infinity)) {
    const readyAt = enduranceReadyAt(current, cost, at, interval.rate, context.epsilon);
    if (readyAt != null && readyAt <= interval.end) return readyAt;
    current += (interval.end - at) * Math.max(0, interval.rate);
    at = interval.end;
  }

  return null;
}

/** Advances Core endurance to a target time and emits the updated Engineer state. */
export function advanceEngineerResources(context: EngineerSchedulerContext, target: number): void {
  const state = professionCoreState(context);
  const from = Number(state.enduranceUpdatedAt || 0);
  if (target <= from) return;
  const maximum = Number(
    state.maximumEndurance ||
      balanceProfileValueFromContext(context, ENGINEER_CORE_BALANCE_PROFILE_IDS.resources, 'maximumStacks', 100)
  );
  for (const interval of enduranceIntervals(context, from, target)) {
    Object.assign(state, advanceEndurance(state, interval.end, interval.rate, maximum));
  }

  emitEngineerStateSnapshot(context, target, 'resources');
}
