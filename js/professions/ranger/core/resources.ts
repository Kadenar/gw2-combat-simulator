import { professionCoreState } from "../../../platform/engine/profession.js";
import { hasTrait } from "../../../platform/gw2/trait-state.js";
import { RANGER_TRAIT_IDS as TRAIT } from "../data/ids.js";
import type { RangerCastContext, RangerSchedulerContext } from "../types.js";

const ENDURANCE_PER_SECOND = 5;
const VIGOR_REGENERATION_BONUS = 0.5;
const NATURAL_VIGOR_REGENERATION_BONUS = 0.25;

function rangerEnduranceRegenerationRate(
  context: RangerSchedulerContext,
  at: number,
): number {
  const vigor = Boolean(
    context.config.boons?.vigor || context.hasBuff?.("vigor", at),
  );
  return (
    ENDURANCE_PER_SECOND *
    (1 +
      (vigor ? VIGOR_REGENERATION_BONUS : 0) +
      (hasTrait({ config: context.config }, TRAIT.NATURAL_VIGOR)
        ? NATURAL_VIGOR_REGENERATION_BONUS
        : 0))
  );
}

export function advanceRangerResources(
  context: RangerSchedulerContext,
  target: number,
): void {
  const state = professionCoreState(context);
  const from = Number(state.enduranceUpdatedAt || 0);
  if (target <= from) return;
  state.endurance = Math.min(
    state.maximumEndurance,
    state.endurance +
      (target - from) *
        rangerEnduranceRegenerationRate(context, (from + target) / 2),
  );
  state.enduranceUpdatedAt = target;
}

export function rangerEnduranceReadyAt(
  context: RangerCastContext,
  cost: number,
): number | null {
  const missing = Math.max(0, cost - professionCoreState(context).endurance);
  if (missing <= context.epsilon) return context.start;
  const rate = rangerEnduranceRegenerationRate(context, context.start);
  return rate > 0 ? context.start + missing / rate : null;
}
