import {
  REVENANT_SKILL_IDS as ID,
  REVENANT_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import { hasRevenantTrait } from "../../core/state.js";
import { VINDICATOR_MECHANICS as MECHANICS } from "./mechanics.js";
import type {
  RevenantPrecastContext,
  RevenantRechargeContext,
} from "../../types.js";

export function modifyVindicatorCastDuration(
  context: RevenantPrecastContext,
  duration: number,
): number {
  // Dodge is not a normal skill cast; override whatever the catalog says with the fixed animation duration.
  return context.skill?.id === ID.DODGE
    ? MECHANICS.endurance.vindicatorDodgeCastTime
    : duration;
}

export function modifyVindicatorRechargeDuration(
  context: RevenantRechargeContext,
  duration: number,
): number {
  // Energy Meld has two skill IDs in the catalog (62757 and 72058) representing the same button in different weapon configurations; both must be matched or one variant silently skips the reduction.
  return (
      [ID.ENERGY_MELD, ID.ENERGY_MELD_ID_72058] as readonly number[]
    ).includes(Number(context.skill?.id)) &&
      hasRevenantTrait(context.config, TRAIT.REAVERS_CURSE)
    ? duration * MECHANICS.endurance.energyMeld.reaversCurseRechargeMultiplier
    : duration;
}
