/**
 * Stable family-level attribute and cast-rule facade.
 *
 * Core and elite implementations live in their respective `rules.ts` slices.
 * The complete application contract still exposes the historical combined
 * hooks from this path.
 */
import {
  compileEngineerModifierRules,
  engineerCoreAttributeRules,
  engineerCoreCastRules,
  engineerCoreModifierRules,
} from "./core/rules.js";
import {
  amalgamAttributeRules,
  amalgamCastRules,
  amalgamModifierRules,
} from "./specializations/amalgam/rules.js";
import {
  holosmithModifierRules,
} from "./specializations/holosmith/rules.js";
import {
  mechanistAttributeRules,
  mechanistCastRules,
  mechanistModifierRules,
} from "./specializations/mechanist/rules.js";
import {
  scrapperCastRules,
  scrapperModifierRules,
} from "./specializations/scrapper/rules.js";
import type { SchedulerRecord } from "../../platform/engine/types.js";
import type { Gw2ModifierContext } from "../../platform/gw2/types.js";
import type {
  EngineerMaximumAmmoContext,
  EngineerRechargeContext,
} from "./types.js";

export const engineerModifierRules = Object.freeze([
  ...engineerCoreModifierRules,
  ...scrapperModifierRules,
  ...holosmithModifierRules,
  ...mechanistModifierRules,
  ...amalgamModifierRules,
]);

export const engineerModifierHooks = compileEngineerModifierRules(
  engineerModifierRules,
);

const attributeSlices = Object.freeze([
  engineerCoreAttributeRules,
  mechanistAttributeRules,
  amalgamAttributeRules,
]);

function modifyEngineerAttributes(
  context: Gw2ModifierContext,
  attributes: SchedulerRecord,
): SchedulerRecord {
  return attributeSlices.reduce(
    (result, slice) =>
      slice.modifyAttributes(context, result),
    attributes,
  );
}

function modifyEngineerRechargeDuration(
  context: EngineerRechargeContext,
  duration: number,
): number {
  return [
    engineerCoreCastRules.modifyRechargeDuration,
    mechanistCastRules.modifyRechargeDuration,
  ].reduce(
    (result, modify) => modify(context, result),
    duration,
  );
}

function modifyEngineerMaximumAmmo(
  context: EngineerMaximumAmmoContext,
  maximum: number,
): number {
  return [
    scrapperCastRules.modifyMaximumAmmo,
    amalgamCastRules.modifyMaximumAmmo,
  ].reduce(
    (result, modify) => modify(context, result),
    maximum,
  );
}

export const engineerAttributeRules = Object.freeze({
  modifyAttributes: modifyEngineerAttributes,
  modifyConditionBaseDuration:
    engineerCoreAttributeRules.modifyConditionBaseDuration,
  ...engineerModifierHooks,
});

export const engineerCastModifiers = Object.freeze({
  modifyRechargeDuration: modifyEngineerRechargeDuration,
  modifyMaximumAmmo: modifyEngineerMaximumAmmo,
});
