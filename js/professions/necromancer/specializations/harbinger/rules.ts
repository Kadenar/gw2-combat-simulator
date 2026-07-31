import {
  professionStaticRulesApplied,
} from "../../../../platform/gw2/attribute-provenance.js";
import { MODIFIER_TARGET } from "../../../../platform/gw2/modifier-rules.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import { NECROMANCER_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import {
  cloneNecromancerAttributes,
  necromancerActiveShroud,
  necromancerCriticalExpectedFactor,
  necromancerRuntimeState,
  necromancerTargetHasCondition,
} from "../../core/rules.js";
import type { SchedulerRecord } from "../../../../platform/engine/types.js";
import type {
  Gw2ModifierContext,
  Gw2ModifierRule,
} from "../../../../platform/gw2/types.js";
import type {
  NecromancerRechargeModifierContext,
  NecromancerSimulationEvent,
} from "../../types.js";

function modifyHarbingerAttributes(
  context: Gw2ModifierContext,
  attributes: SchedulerRecord,
): SchedulerRecord {
  const result = cloneNecromancerAttributes(attributes);
  if (!professionStaticRulesApplied(context.config)) {
    if (
      context.config?.specialization === "Harbinger" ||
      hasTrait(context, TRAIT.ALCHEMIC_VIGOR)
    ) {
      result.vitality += 240;
    }
    if (hasTrait(context, TRAIT.IMPLACABLE_FOE)) {
      result.ferocity += Number(result.vitality || 0) * 0.13;
    }
    if (hasTrait(context, TRAIT.TWISTED_MEDICINE)) {
      result.concentration += Number(result.vitality || 0) * 0.13;
    }
    if (hasTrait(context, TRAIT.DARK_GUNSLINGER)) {
      result.expertise += Math.round(Number(result.vitality || 0) * 0.1);
    }
  }
  return result;
}

function activeBlight(context: Gw2ModifierContext): number {
  const event = context.event as NecromancerSimulationEvent | undefined;
  return Math.max(
    0,
    Number(
      event?.necromancerBlight ??
        necromancerRuntimeState(context).blight ??
        0,
    ),
  );
}

function wickedCorruptionCriticalFactor(context: Gw2ModifierContext): number {
  const deathPerceptionActive =
    hasTrait(context, TRAIT.DEATH_PERCEPTION) &&
    Boolean(necromancerActiveShroud(context));
  const coreFactor = deathPerceptionActive
    ? necromancerCriticalExpectedFactor(context, 1.1)
    : 1;
  const combinedFactor = necromancerCriticalExpectedFactor(
    context,
    deathPerceptionActive ? 1.21 : 1.1,
  );
  return combinedFactor / coreFactor;
}

function modifyHarbingerRechargeDuration(
  context: NecromancerRechargeModifierContext,
  duration: number,
): number {
  return context.skill?.weapon === "Pistol" &&
      hasTrait(context, TRAIT.DARK_GUNSLINGER)
    ? duration * 0.8
    : duration;
}

export const harbingerModifierRules: readonly Gw2ModifierRule[] =
  Object.freeze([
    {
      id: "necromancer.wicked-corruption-blight",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "damage-additive",
      amount: (context) => activeBlight(context) * 0.01,
      when: (context) => hasTrait(context, TRAIT.WICKED_CORRUPTION),
    },
    {
      id: "necromancer.wicked-corruption-critical-hit-damage",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: wickedCorruptionCriticalFactor,
      order: 100,
      when: (context) =>
        hasTrait(context, TRAIT.WICKED_CORRUPTION) &&
        necromancerTargetHasCondition(context, "Torment"),
    },
    {
      id: "necromancer.septic-corruption-blight",
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: "damage-additive",
      amount: (context) => activeBlight(context) * 0.0025,
      when: (context) => hasTrait(context, TRAIT.SEPTIC_CORRUPTION),
    },
    {
      id: "necromancer.cascading-corruption",
      target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
      operation: "damage-additive",
      amount: 0.1,
      when: (context) =>
        hasTrait(context, TRAIT.CASCADING_CORRUPTION) &&
        Number(necromancerRuntimeState(context).meltdownUntil || 0)
          > context.time,
    },
  ]);

export const harbingerAttributeRules = Object.freeze({
  modifyAttributes: modifyHarbingerAttributes,
  modifierRules: harbingerModifierRules,
});

export const harbingerCastRules = Object.freeze({
  modifyRechargeDuration: modifyHarbingerRechargeDuration,
});
