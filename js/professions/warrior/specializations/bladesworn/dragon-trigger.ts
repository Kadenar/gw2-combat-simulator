import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import { WARRIOR_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import type {
  WarriorCastContext,
  WarriorSchedulerContext,
} from "../../types.js";

export const DRAGON_CHARGE_INTERVAL_SECONDS = 0.5;
export const DRAGON_FLOW_PER_CHARGE = 10;

type DragonTriggerContext = WarriorCastContext | WarriorSchedulerContext;

export function maximumDragonCharges(context: DragonTriggerContext): number {
  return hasTrait(context, TRAIT.DARING_DRAGON) ? 5 : 10;
}

export function requestedDragonCharges(
  context: WarriorCastContext,
  maximumCharges: number,
): number {
  const configured = context.command.releaseAtCharges;
  if (configured == null) return maximumCharges;
  return Math.min(maximumCharges, Math.max(1, configured));
}
