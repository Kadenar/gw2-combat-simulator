import { targetConditionStacks as configuredTargetConditionStacks } from "../../../../platform/gw2/target-state.js";
import { MODIFIER_TARGET } from "../../../../platform/gw2/modifier-rules.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import { NECROMANCER_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import {
  cloneNecromancerAttributes,
  necromancerActiveShroud,
  necromancerEventSkill,
  necromancerTargetChilled,
} from "../../core/rules.js";
import type { SchedulerRecord } from "../../../../platform/engine/types.js";
import type {
  Gw2ModifierContext,
  Gw2ModifierRule,
} from "../../../../platform/gw2/types.js";
import type { NecromancerCastModifierContext } from "../../types.js";

function modifyReaperAttributes(
  context: Gw2ModifierContext,
  attributes: SchedulerRecord,
): SchedulerRecord {
  const result = cloneNecromancerAttributes(attributes);
  if (
    hasTrait(context, TRAIT.REAPERS_ONSLAUGHT) &&
    necromancerActiveShroud(context) === "reaper"
  ) {
    result.ferocity += 300;
  }
  return result;
}

function modifyReaperCastDuration(
  context: NecromancerCastModifierContext,
  duration: number,
): number {
  return hasTrait(context, TRAIT.REAPERS_ONSLAUGHT) &&
    context.state.profession.activeShroud === "reaper" &&
    !context.hasBuff?.("quickness", context.start)
    ? duration / 1.5
    : duration;
}

export const reaperModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: "necromancer.reaper-shout-melee",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 2,
    order: 100,
    when: (context) =>
      Boolean(
        context.event?.actorType === "player" &&
        necromancerEventSkill(context)?.categories?.includes("Shout") &&
        context.config?.target?.nearby !== false,
      ),
  },
  {
    id: "necromancer.decimate-defenses",
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: "add",
    amount: (context) =>
      Math.min(
        25,
        Number(
          context.query?.targetConditionStacks
            ? context.query.targetConditionStacks(
                "Vulnerability",
                context.time,
                context.runtime,
              )
            : configuredTargetConditionStacks(
                context.config || {},
                "Vulnerability",
                context.time,
                context.runtime,
              ),
        ),
      ) * 0.02,
    when: (context) => hasTrait(context, TRAIT.DECIMATE_DEFENSES),
  },
  {
    id: "necromancer.cold-shoulder",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.15,
    order: 100,
    when: (context) =>
      hasTrait(context, TRAIT.COLD_SHOULDER) &&
      necromancerTargetChilled(context),
  },
  {
    id: "necromancer.soul-eater",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.15,
    order: 100,
    when: (context) =>
      hasTrait(context, TRAIT.SOUL_EATER) &&
      context.config?.target?.nearby !== false,
  },
]);

export const reaperAttributeRules = Object.freeze({
  modifyAttributes: modifyReaperAttributes,
  modifierRules: reaperModifierRules,
});

export const reaperCastRules = Object.freeze({
  modifyCastDuration: modifyReaperCastDuration,
});
