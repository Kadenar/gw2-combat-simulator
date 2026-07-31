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
  return context.skill?.id === ID.DODGE
    ? MECHANICS.endurance.vindicatorDodgeCastTime
    : duration;
}

export function modifyVindicatorRechargeDuration(
  context: RevenantRechargeContext,
  duration: number,
): number {
  return (
      [ID.ENERGY_MELD, ID.ENERGY_MELD_ID_72058] as readonly number[]
    ).includes(Number(context.skill?.id)) &&
      hasRevenantTrait(context.config, TRAIT.REAVERS_CURSE)
    ? duration * MECHANICS.endurance.energyMeld.reaversCurseRechargeMultiplier
    : duration;
}
