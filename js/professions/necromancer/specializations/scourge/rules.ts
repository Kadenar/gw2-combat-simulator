import {
  professionStaticRulesApplied,
} from "../../../../platform/gw2/attribute-provenance.js";
import { MODIFIER_TARGET } from "../../../../platform/gw2/modifier-rules.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import {
  NECROMANCER_SKILL_IDS as ID,
  NECROMANCER_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import {
  cloneNecromancerAttributes,
  necromancerRuntimeSpecializationState,
} from "../../core/rules.js";
import type { SchedulerRecord } from "../../../../platform/engine/types.js";
import type {
  Gw2ModifierContext,
  Gw2ModifierRule,
} from "../../../../platform/gw2/types.js";
import type {
  NecromancerAmmoModifierContext,
  NecromancerRechargeModifierContext,
} from "../../types.js";

function modifyScourgeAttributes(
  context: Gw2ModifierContext,
  attributes: SchedulerRecord,
): SchedulerRecord {
  const result = cloneNecromancerAttributes(attributes);
  if (
    !professionStaticRulesApplied(context.config) &&
    hasTrait(context, TRAIT.FELL_BEACON)
  ) {
    // Pattern C: convert gear-only condition damage (config.stats), excluding
    // might (baked into the seed) and trait bonuses like Lingering Curse.
    result.expertise += Number(context.config?.stats?.conditionDamage || 0) * 0.07;
  }
  if (
    hasTrait(context, TRAIT.SAND_SAGE) &&
    (necromancerRuntimeSpecializationState(context).shades || []).some(
      (expiresAt: number) => expiresAt > context.time,
    )
  ) {
    result.concentration += 225;
    result.expertise += 225;
  }
  return result;
}

function modifyScourgeRechargeDuration(
  context: NecromancerRechargeModifierContext,
  duration: number,
): number {
  return (
    context.skill?.id === ID.MANIFEST_SAND_SHADE &&
    hasTrait(context, TRAIT.SAND_SAVANT)
  )
    ? duration * 1.25
    : duration;
}

function modifyScourgeMaximumAmmo(
  context: NecromancerAmmoModifierContext,
  maximum: number,
): number {
  return (
    context.skill?.id === ID.MANIFEST_SAND_SHADE &&
    hasTrait(context, TRAIT.SAND_SAVANT)
  )
    ? 1
    : maximum;
}

export const scourgeModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: "necromancer.fell-beacon",
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: "multiply",
    factor: 1.1,
    order: 100,
    when: (context) =>
      context.condition === "Burning" &&
      hasTrait(context, TRAIT.FELL_BEACON),
  },
  {
    id: "necromancer.demonic-lore",
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: "multiply",
    factor: 1.33,
    order: 100,
    when: (context) =>
      context.condition === "Torment" &&
      hasTrait(context, TRAIT.DEMONIC_LORE),
  },
]);

export const scourgeAttributeRules = Object.freeze({
  modifyAttributes: modifyScourgeAttributes,
  modifierRules: scourgeModifierRules,
});

export const scourgeCastRules = Object.freeze({
  modifyRechargeDuration: modifyScourgeRechargeDuration,
  modifyMaximumAmmo: modifyScourgeMaximumAmmo,
});
