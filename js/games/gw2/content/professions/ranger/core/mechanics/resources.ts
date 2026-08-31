import { balanceProfileValueFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { advanceEndurance, enduranceReadyAt } from '#gw2/platform/combat/resources/endurance.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/content/professions/ranger/data/ids.js';
import type { RangerCastContext, RangerSchedulerContext } from '#gw2/content/professions/ranger/types.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/ranger/core/profiles.js';

function rangerEnduranceRegenerationRate(context: RangerSchedulerContext, at: number): number {
  const vigor = Boolean(context.config.boons?.vigor || context.hasBuff?.('vigor', at));
  return (
    balanceProfileValueFromContext(context, PROFILE.resources, 'enduranceRegenerationPerSecond', 5) *
    (1 +
      (vigor ? balanceProfileValueFromContext(context, PROFILE.resources, 'vigorRegenerationMultiplier', 1.5) - 1 : 0) +
      (hasTrait({ config: context.config }, TRAIT.NATURAL_VIGOR)
        ? balanceProfileValueFromContext(context, PROFILE.naturalVigor, 'vigorRegenerationMultiplier', 0.25)
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
