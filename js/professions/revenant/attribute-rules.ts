/** Stable application facade for module-owned Revenant attribute rules. */
import {
  compileRevenantModifierRules,
  revenantCoreAttributeRules,
  revenantCoreModifierRules,
} from "./core/attribute-rules.js";
import {
  conduitAttributeRules,
  conduitModifierRules,
} from "./specializations/conduit/rules.js";
import {
  heraldAttributeRules,
  heraldModifierRules,
} from "./specializations/herald/rules.js";
import {
  renegadeAttributeRules,
  renegadeModifierRules,
} from "./specializations/renegade/rules.js";
import {
  vindicatorAttributeRules,
  vindicatorModifierRules,
} from "./specializations/vindicator/rules.js";
import type { Gw2ModifierContext, Gw2Stats } from "../../platform/gw2/types.js";

interface AttributeSlice {
  readonly modifyAttributes?: (
    context: Gw2ModifierContext,
    attributes: Gw2Stats,
  ) => Gw2Stats;
  readonly modifyCriticalChance?: (
    context: Gw2ModifierContext,
    chance: number,
  ) => number;
  readonly modifyConditionDuration?: (
    context: Gw2ModifierContext,
    duration: number,
  ) => number;
}

export const revenantModifierRules = Object.freeze([
  ...revenantCoreModifierRules,
  ...heraldModifierRules,
  ...renegadeModifierRules,
  ...vindicatorModifierRules,
  ...conduitModifierRules,
]);

const modifierHooks = compileRevenantModifierRules(revenantModifierRules);
const slices = Object.freeze([
  revenantCoreAttributeRules,
  heraldAttributeRules,
  renegadeAttributeRules,
  vindicatorAttributeRules,
  conduitAttributeRules,
]) as unknown as readonly AttributeSlice[];

function reduceNumberHook(
  name: "modifyCriticalChance" | "modifyConditionDuration",
  context: Gw2ModifierContext,
  value: number,
): number {
  return slices.reduce((result, slice) => {
    const hook = slice[name] as
      | ((hookContext: Gw2ModifierContext, current: number) => number)
      | undefined;
    return hook ? hook(context, result) : result;
  }, value);
}

export const revenantAttributeRules = Object.freeze({
  ...modifierHooks,
  modifyAttributes: (
    context: Gw2ModifierContext,
    attributes: Gw2Stats,
  ): Gw2Stats =>
    slices.reduce(
      (result, slice) =>
        slice.modifyAttributes
          ? slice.modifyAttributes(context, result)
          : result,
      attributes,
    ),
  modifyCriticalChance: (context: Gw2ModifierContext, chance: number) =>
    reduceNumberHook("modifyCriticalChance", context, chance),
  modifyConditionDuration: (context: Gw2ModifierContext, duration: number) =>
    reduceNumberHook("modifyConditionDuration", context, duration),
});
