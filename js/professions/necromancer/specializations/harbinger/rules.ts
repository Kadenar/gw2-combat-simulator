import { professionStaticRulesApplied } from "../../../../platform/gw2/attribute-provenance.js";
import { MODIFIER_TARGET } from "../../../../platform/gw2/modifier-rules.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import {
  NECROMANCER_SKILL_IDS as ID,
  NECROMANCER_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import { professionCoreState } from "../../../../platform/engine/profession.js";
import {
  emitBuff,
  gainNecromancerLifeForce,
  hasTrait as hasNecromancerTrait,
} from "../../core/shared.js";
import { advanceHarbingerBlight } from "./blight.js";
import { harbingerState } from "./state.js";
import {
  cloneNecromancerAttributes,
  necromancerActiveShroud,
  necromancerCriticalExpectedFactor,
  necromancerRuntimeSpecializationState,
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
  NecromancerCastContext,
  NecromancerSkill,
} from "../../types.js";

function afterCast(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
): void {
  const state = harbingerState.from(context);
  const at = context.effectiveEnd;
  advanceHarbingerBlight(context, at);
  if (
    skill.id === ID.HARBINGER_SHROUD &&
    professionCoreState(context).activeShroud === "harbinger"
  ) {
    state.nextBlightAt = Math.floor(at) + 1;
    if (hasNecromancerTrait(context, TRAIT.CORRUPTED_TALENT)) {
      gainNecromancerLifeForce(context, 15, at);
    }
    if (hasNecromancerTrait(context, TRAIT.DEATHLY_HASTE)) {
      emitBuff(context, skill, "quickness", 4);
      emitBuff(context, skill, "fury", 4);
    }
    if (hasNecromancerTrait(context, TRAIT.IMPLACABLE_FOE)) {
      emitBuff(context, skill, "stability", 5, 3);
      emitBuff(context, skill, "implacable-foe", 2);
    }
  }
  if (
    skill.id === ID.DARK_BARRAGE &&
    hasNecromancerTrait(context, TRAIT.DEATHLY_HASTE)
  ) {
    const deathlyHaste = { source: "Trait", sourceId: TRAIT.DEATHLY_HASTE };
    emitBuff(context, skill, "quickness", 4, 1, { at, metadata: deathlyHaste });
    emitBuff(context, skill, "fury", 4, 1, { at, metadata: deathlyHaste });
  }
}

export const harbingerSchedulerHooks = Object.freeze({
  advance: {
    id: "harbinger.advance-blight",
    order: -10,
    handler: advanceHarbingerBlight,
  },
  afterCast: {
    id: "harbinger.after-cast",
    order: -10,
    handler: afterCast,
  },
});

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
        necromancerRuntimeSpecializationState(context).blight ??
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

export const harbingerModifierRules: readonly Gw2ModifierRule[] = Object.freeze(
  [
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
        Number(
          necromancerRuntimeSpecializationState(context).meltdownUntil || 0,
        ) > context.time,
    },
  ],
);

export const harbingerAttributeRules = Object.freeze({
  modifyAttributes: modifyHarbingerAttributes,
  modifierRules: harbingerModifierRules,
});

export const harbingerCastRules = Object.freeze({
  modifyRechargeDuration: modifyHarbingerRechargeDuration,
});
