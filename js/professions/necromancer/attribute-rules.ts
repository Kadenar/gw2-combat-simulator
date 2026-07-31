/**
 * Stable family-level attribute and cast-rule facade.
 *
 * Core and elite implementations live in their respective `rules.ts` slices.
 * The complete application contract still exposes the historical combined
 * hooks from this path.
 */
import {
  compileNecromancerModifierRules,
  necromancerCoreAttributeRules,
  necromancerCoreCastRules,
  necromancerCoreModifierRules,
} from "./core/rules.js";
import {
  harbingerAttributeRules,
  harbingerCastRules,
  harbingerModifierRules,
} from "./specializations/harbinger/rules.js";
import {
  reaperAttributeRules,
  reaperCastRules,
  reaperModifierRules,
} from "./specializations/reaper/rules.js";
import {
  ritualistAttributeRules,
  ritualistModifierRules,
} from "./specializations/ritualist/rules.js";
import {
  scourgeAttributeRules,
  scourgeCastRules,
  scourgeModifierRules,
} from "./specializations/scourge/rules.js";
import type { SchedulerRecord } from "../../platform/engine/types.js";
import type { Gw2ModifierContext } from "../../platform/gw2/types.js";
import type {
  NecromancerAmmoModifierContext,
  NecromancerCastModifierContext,
  NecromancerRechargeModifierContext,
} from "./types.js";

export const necromancerModifierRules = Object.freeze([
  ...necromancerCoreModifierRules,
  ...reaperModifierRules,
  ...scourgeModifierRules,
  ...harbingerModifierRules,
  ...ritualistModifierRules,
]);

export const necromancerModifierHooks = compileNecromancerModifierRules(
  necromancerModifierRules,
);

const attributeSlices = Object.freeze([
  necromancerCoreAttributeRules,
  reaperAttributeRules,
  scourgeAttributeRules,
  harbingerAttributeRules,
  ritualistAttributeRules,
]);

function modifyNecromancerAttributes(
  context: Gw2ModifierContext,
  attributes: SchedulerRecord,
): SchedulerRecord {
  return attributeSlices.reduce(
    (result, slice) =>
      slice.modifyAttributes
        ? slice.modifyAttributes(context, result)
        : result,
    attributes,
  );
}

function modifyNecromancerRechargeDuration(
  context: NecromancerRechargeModifierContext,
  duration: number,
): number {
  return [
    necromancerCoreCastRules.modifyRechargeDuration,
    scourgeCastRules.modifyRechargeDuration,
    harbingerCastRules.modifyRechargeDuration,
  ].reduce(
    (result, modify) => modify(context, result),
    duration,
  );
}

export const necromancerAttributeRules = Object.freeze({
  modifyAttributes: modifyNecromancerAttributes,
  modifyConditionBaseDuration:
    necromancerCoreAttributeRules.modifyConditionBaseDuration,
  ...necromancerModifierHooks,
});

export const necromancerCastModifiers = Object.freeze({
  modifyCastDuration: (
    context: NecromancerCastModifierContext,
    duration: number,
  ) => reaperCastRules.modifyCastDuration(context, duration),
  modifyRechargeDuration: modifyNecromancerRechargeDuration,
  modifyRechargeStart: (
    context: NecromancerCastModifierContext,
    rechargeStart: number,
  ) =>
    necromancerCoreCastRules.modifyRechargeStart(context, rechargeStart),
  modifyMaximumAmmo: (
    context: NecromancerAmmoModifierContext,
    maximum: number,
  ) => scourgeCastRules.modifyMaximumAmmo(context, maximum),
});
