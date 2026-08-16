import type { SchedulerRecord } from "../../../../platform/engine/types.js";
import { MODIFIER_TARGET } from "../../../../platform/gw2/modifier-rules.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import type {
  Gw2ModifierContext,
  Gw2ModifierRule,
} from "../../../../platform/gw2/types.js";
import {
  elementalistAttunements,
  elementalistTimedBuffStacks,
} from "../../core/modifiers.js";
import type { ElementalistRuntimeState } from "../../types.js";

function playerEvent(context: Gw2ModifierContext): boolean {
  return context.event?.actorType !== "summon";
}

export const weaverModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: "elementalist.weave-self-air",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: 0.1,
    when: (context) =>
      elementalistTimedBuffStacks(context, "weave self air", 1) > 0,
  },
  {
    id: "elementalist.weave-self-fire",
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: "damage-additive",
    amount: 0.2,
    when: (context) =>
      elementalistTimedBuffStacks(context, "weave self fire", 1) > 0,
  },
  {
    id: "elementalist.elements-of-rage-strike",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: 0.15,
    when: (context) =>
      hasTrait(context, "Elements of Rage") &&
      elementalistTimedBuffStacks(context, "elements of rage", 1) > 0,
  },
  {
    id: "elementalist.elements-of-rage-condition",
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: "damage-additive",
    amount: 0.1,
    when: (context) =>
      hasTrait(context, "Elements of Rage") &&
      elementalistTimedBuffStacks(context, "elements of rage", 1) > 0,
  },
  {
    id: "elementalist.superior-elements",
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: "add",
    amount: 0.2,
    when: (context) =>
      playerEvent(context) &&
      hasTrait(context, "Superior Elements") &&
      Boolean(
        context.query?.targetHasCondition(
          "Weakness",
          context.time,
          context.runtime,
        ),
      ),
  },
]);

function modifyWeaverAttributes(
  context: Gw2ModifierContext,
  attributes: SchedulerRecord,
): SchedulerRecord {
  if (!hasTrait(context, "Elemental Polyphony")) return attributes;
  const modified = { ...attributes };
  const active = elementalistAttunements(context);
  const runtimeCore = (
    context.runtime?.profession as ElementalistRuntimeState | undefined
  )?.core;
  if (
    runtimeCore?.secondaryAttunement == null &&
    typeof context.config?.secondaryAttunement === "string"
  ) {
    active.add(context.config.secondaryAttunement);
  }
  if (active.has("Fire")) modified.power = Number(modified.power || 0) + 200;
  if (active.has("Air")) {
    modified.ferocity = Number(modified.ferocity || 0) + 200;
  }
  if (active.has("Earth")) {
    modified.conditionDamage = Number(modified.conditionDamage || 0) + 200;
  }
  return modified;
}

export { modifyWeaverAttributes };
