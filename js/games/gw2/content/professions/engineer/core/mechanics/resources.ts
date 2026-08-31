import { balanceProfileValueFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { emitStateSnapshot } from '#gw2/platform/engine/events/state-snapshots.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { snapshotEngineerState } from '#gw2/content/professions/engineer/state.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/content/professions/engineer/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { advanceEndurance, enduranceReadyAt } from '#gw2/platform/combat/resources/endurance.js';
import { ENGINEER_CORE_BALANCE_PROFILE_IDS } from '#gw2/content/professions/engineer/core/profiles.js';
import type { EngineerSchedulerContext } from '#gw2/content/professions/engineer/types.js';

// start is optional because this context is used in both precast (has start) and general advance calls
type EngineerResourceContext = EngineerSchedulerContext & {
  readonly start?: number;
};

/** Calculates current endurance regeneration after Vigor and Adrenal Implant modifiers. */
export function engineerEnduranceRegenerationRate(
  context: EngineerResourceContext,
  at = Number(context.start ?? context.state?.time ?? 0)
): number {
  const vigor = Boolean(context.config?.boons?.vigor || context.hasBuff?.('vigor', at));
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

/** Predicts when the requested endurance cost becomes affordable, or returns null if it cannot. */
export function engineerEnduranceReadyAt(
  context: EngineerResourceContext & { readonly start: number },
  cost: number
): number | null {
  const current = Number(professionCoreState(context).endurance || 0);
  const rate = engineerEnduranceRegenerationRate(context, context.start);
  return enduranceReadyAt(current, Number(cost || 0), context.start, rate, Number(context.epsilon || 0.0001));
}

/** Advances Core endurance to a target time and emits the updated Engineer state. */
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
          balanceProfileValueFromContext(context, ENGINEER_CORE_BALANCE_PROFILE_IDS.resources, 'maximumStacks', 100)
      )
    )
  );
  emitStateSnapshot(context, 'engineer', target, 'resources', snapshotEngineerState(context.state.profession));
}
