import { emitStateSnapshot } from '../../../platform/engine/events/state-snapshots.js';
import { professionCoreState } from '../../../platform/engine/profession/state.js';
import { snapshotEngineerState } from '../state.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '../data/ids.js';
import { hasTrait } from '../../../platform/gw2/combat/state/traits.js';
import { advanceEndurance, enduranceReadyAt } from '../../../platform/gw2/combat/resources/endurance.js';
import { ENGINEER_CORE_BALANCE_PROFILE_IDS, engineerBalanceValue } from './profiles.js';
import type { EngineerSchedulerContext } from '../types.js';

// start is optional because this context is used in both precast (has start) and general advance calls
type EngineerResourceContext = EngineerSchedulerContext & {
  readonly start?: number;
};

export function engineerEnduranceRegenerationRate(
  context: EngineerResourceContext,
  at = Number(context.start ?? context.state?.time ?? 0)
): number {
  const vigor = Boolean(context.config?.boons?.vigor || context.hasBuff?.('vigor', at));
  const multiplier =
    1 +
    (vigor
      ? engineerBalanceValue(context, ENGINEER_CORE_BALANCE_PROFILE_IDS.resources, 'vigorRegenerationMultiplier', 1.5) -
        1
      : 0) +
    (hasTrait(context.config, TRAIT.ADRENAL_IMPLANT)
      ? engineerBalanceValue(context, ENGINEER_CORE_BALANCE_PROFILE_IDS.resources, 'coefficientMultiplier', 1.25) - 1
      : 0);
  return (
    engineerBalanceValue(context, ENGINEER_CORE_BALANCE_PROFILE_IDS.resources, 'enduranceRegenerationPerSecond', 5) *
    multiplier
  );
}

export function engineerEnduranceReadyAt(
  context: EngineerResourceContext & { readonly start: number },
  cost: number
): number | null {
  const current = Number(professionCoreState(context).endurance || 0);
  const rate = engineerEnduranceRegenerationRate(context, context.start);
  return enduranceReadyAt(current, Number(cost || 0), context.start, rate, Number(context.epsilon || 0.0001));
}

export function advanceEngineerResources(context: EngineerSchedulerContext, target: number): void {
  const state = professionCoreState(context);
  const from = Number(state.enduranceUpdatedAt || 0);
  if (target <= from) return;
  // rate is evaluated at the midpoint of the window — accurate when vigor doesn't toggle mid-advance
  Object.assign(
    state,
    advanceEndurance(
      state,
      target,
      engineerEnduranceRegenerationRate(context, (from + target) / 2),
      Number(
        state.maximumEndurance ||
          engineerBalanceValue(context, ENGINEER_CORE_BALANCE_PROFILE_IDS.resources, 'maximumStacks', 100)
      )
    )
  );
  emitStateSnapshot(context, 'engineer', target, 'resources', snapshotEngineerState(context.state.profession));
}
