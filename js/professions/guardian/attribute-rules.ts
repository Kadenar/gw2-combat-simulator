/**
 * Stable application-level rule facade. Runtime composition uses Core plus
 * only the selected elite's declarations.
 */
import {
  compileGuardianModifierRules,
  guardianCoreAttributeRules,
  guardianCoreCastRules,
  guardianCoreModifierRules,
} from "./core/rules.js";
import { firebrandAttributeRules } from "./specializations/firebrand/rules.js";
import {
  luminaryAttributeRules,
  luminaryModifierRules,
} from "./specializations/luminary/rules.js";
import type { SchedulerRecord } from "../../platform/engine/types.js";
import type {
  Gw2ModifierContext,
  Gw2ResolvedStats,
} from "../../platform/gw2/types.js";
import type { GuardianCastContext, GuardianSchedulerContext } from "./types.js";

export const guardianModifierRules = Object.freeze([
  ...guardianCoreModifierRules,
  ...luminaryModifierRules,
]);

const guardianModifierHooks = compileGuardianModifierRules(
  guardianModifierRules,
);

function modifyGuardianAttributes(
  context: Gw2ModifierContext,
  attributes: Gw2ResolvedStats,
): Gw2ResolvedStats {
  return [
    guardianCoreAttributeRules.modifyAttributes,
    firebrandAttributeRules.modifyAttributes,
  ].reduce((result, modify) => modify(context, result), attributes);
}

export const guardianAttributeRules = Object.freeze({
  modifyAttributes: modifyGuardianAttributes,
  ...guardianModifierHooks,
});

export const guardianCastModifiers = Object.freeze({
  modifyCastDuration: (context: GuardianCastContext, duration: number) =>
    guardianCoreCastRules.modifyCastDuration(context, duration),
  modifyRechargeDuration: (
    context: GuardianSchedulerContext & SchedulerRecord,
    duration: number,
  ) => guardianCoreCastRules.modifyRechargeDuration(context, duration),
  modifyMaximumAmmo: (
    context: GuardianSchedulerContext & SchedulerRecord,
    maximum: number,
  ) => guardianCoreCastRules.modifyMaximumAmmo(context, maximum),
});

export { luminaryAttributeRules };
