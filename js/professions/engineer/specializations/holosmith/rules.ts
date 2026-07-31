import { MODIFIER_TARGET } from "../../../../platform/gw2/modifier-rules.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import { ENGINEER_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import {
  engineerEvent,
  engineerSpecializationState,
  eventSkill,
  playerStrike,
} from "../../core/rule-helpers.js";
import { holosmithCastAvailability } from "./availability.js";
import type {
  Gw2ModifierContext,
  Gw2ModifierRule,
} from "../../../../platform/gw2/types.js";

function heatTierStrikeFactor(context: Gw2ModifierContext): number {
  const heat = Number(
    engineerSpecializationState(context, "Holosmith").heat || 0,
  );
  const event = engineerEvent(context);
  const skillName = String(eventSkill(context)?.name || event?.skillName || "");
  if (["Sun Edge", "Sun Ripper", "Gleam Saber"].includes(skillName)) {
    if (
      heat >= 100
      && hasTrait(context, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT)
    ) {
      return 1.3;
    }
    return heat > 50 ? 1.2 : 1;
  }
  if (skillName === "Blade Burst" && heat > 50) {
    if (
      heat >= 100
      && hasTrait(context, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT)
    ) {
      return 1.35;
    }
    return 1.25;
  }
  const enhancedCapacityTier =
    event?.enhancedCapacityTier === true
    || (
      heat >= 100
      && hasTrait(context, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT)
    );
  if (skillName === "Particle Accelerator" && heat > 50) {
    return enhancedCapacityTier ? 1.35 : 1.1;
  }
  if (!enhancedCapacityTier) return 1;
  if (["Laser Disk", "Launch Wall"].includes(skillName)) return 1.35;
  if (
    skillName === "Prismatic Singularity"
    && event?.name === "Explosion Damage"
  ) {
    return 1.25;
  }
  if (
    skillName === "Prime Light Beam"
    && event?.name === "Field Damage"
  ) {
    return 1.2;
  }
  return 1;
}

export const holosmithModifierRules: readonly Gw2ModifierRule[] =
  Object.freeze([
    {
      id: "engineer.lasers-edge",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: (context) => {
        const state = engineerSpecializationState(context, "Holosmith");
        const maximum = hasTrait(
          context,
          TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT,
        )
          ? 0.225
          : 0.15;
        return 1 + Math.min(maximum, Number(state.heat || 0) * 0.0015);
      },
      when: (context) => {
        const state = engineerSpecializationState(context, "Holosmith");
        return (
          playerStrike(context)
          && hasTrait(context, TRAIT.LASERS_EDGE)
          && (
            Boolean(state.photonForgeActive)
            || (
              hasTrait(context, TRAIT.PHOTONIC_BLASTING_MODULE)
              && Boolean(state.overheated)
              && Number(state.heat || 0) > 0
            )
          )
        );
      },
    },
    {
      id: "engineer.solar-focusing-lens",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "damage-additive",
      amount: 0.1,
      when: (context) =>
        playerStrike(context)
        && hasTrait(context, TRAIT.SOLAR_FOCUSING_LENS)
        && context.event?.solarFocusingLens === true,
    },
    {
      id: "engineer.enhanced-capacity-damage-tier",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: heatTierStrikeFactor,
      when: (context) =>
        playerStrike(context)
        && heatTierStrikeFactor(context) > 1,
    },
    {
      id: "engineer.enhanced-capacity-prime-light-beam-duration",
      target: MODIFIER_TARGET.CONDITION_DURATION,
      operation: "add",
      amount: 0.5,
      when: (context) =>
        context.condition === "Burning"
        && context.event?.skillName === "Prime Light Beam"
        && hasTrait(context, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT)
        && context.event?.enhancedCapacityTier === true,
    },
  ]);

export const holosmithAttributeRules = Object.freeze({
  modifierRules: holosmithModifierRules,
});

export const holosmithCastRules = Object.freeze({
  availability: {
    id: "engineer.holosmith-availability",
    order: 30,
    handler: holosmithCastAvailability,
  },
});
