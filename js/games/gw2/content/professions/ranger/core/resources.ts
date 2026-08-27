import { professionCoreState } from '../../../../platform/engine/profession/state.js';
import { hasTrait } from '../../../../platform/combat/state/traits.js';
import { advanceEndurance, enduranceReadyAt } from '../../../../platform/combat/resources/endurance.js';
import { RANGER_TRAIT_IDS as TRAIT } from '../data/ids.js';
import type { RangerCastContext, RangerSchedulerContext } from '../types.js';
import { rangerBalanceValue, RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';

function rangerEnduranceRegenerationRate(context: RangerSchedulerContext, at: number): number {
  const vigor = Boolean(context.config.boons?.vigor || context.hasBuff?.('vigor', at));
  return (
    rangerBalanceValue(context, PROFILE.resources, 'enduranceRegenerationPerSecond', 5) *
    (1 +
      (vigor ? rangerBalanceValue(context, PROFILE.resources, 'vigorRegenerationMultiplier', 1.5) - 1 : 0) +
      (hasTrait({ config: context.config }, TRAIT.NATURAL_VIGOR)
        ? rangerBalanceValue(context, PROFILE.naturalVigor, 'vigorRegenerationMultiplier', 0.25)
        : 0))
  );
}

export function advanceRangerResources(context: RangerSchedulerContext, target: number): void {
  const state = professionCoreState(context);
  const from = Number(state.enduranceUpdatedAt || 0);
  if (target <= from) return;
  Object.assign(
    state,
    advanceEndurance(
      state,
      target,
      rangerEnduranceRegenerationRate(context, (from + target) / 2),
      state.maximumEndurance
    )
  );
}

export function rangerEnduranceReadyAt(context: RangerCastContext, cost: number): number | null {
  const rate = rangerEnduranceRegenerationRate(context, context.start);
  return enduranceReadyAt(professionCoreState(context).endurance, cost, context.start, rate, context.epsilon);
}
