/**
 * Stable application-facing attribute-rule facade.
 * Runtime modules import Core or specialization-owned declarations.
 */
import {
  applyMesmerCoreAttributes,
  compileMesmerModifierRules,
  mesmerCoreAttributeRules,
  mesmerCoreModifierRules,
} from "./core/attribute-rules.js";
import { chronomancerModifierRules } from "./specializations/chronomancer/rules.js";
import { mirageModifierRules } from "./specializations/mirage/rules.js";
import {
  applyTroubadourAttributes,
  troubadourModifierRules,
} from "./specializations/troubadour/rules.js";
import { virtuosoModifierRules } from "./specializations/virtuoso/rules.js";
import type {
  Gw2ModifierContext,
  Gw2ModifierRule,
  Gw2ResolvedStats,
} from "../../platform/gw2/types.js";

export const mesmerModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  ...mesmerCoreModifierRules,
  ...chronomancerModifierRules,
  ...mirageModifierRules,
  ...virtuosoModifierRules,
  ...troubadourModifierRules,
]);

const mesmerModifierHooks = compileMesmerModifierRules(mesmerModifierRules);

export const {
  modifyCriticalChance: applyMesmerCriticalChance,
  modifyCriticalDamage: applyMesmerCriticalDamage,
  modifyStrikeDamage: applyMesmerStrikeDamage,
  modifyConditionDamage: applyMesmerConditionDamage,
  modifyConditionDuration: applyMesmerConditionDuration,
} = mesmerModifierHooks;

export function applyMesmerAttributes(
  context: Gw2ModifierContext,
  attributes: Gw2ResolvedStats,
): Gw2ResolvedStats {
  return applyTroubadourAttributes(
    context,
    applyMesmerCoreAttributes(context, attributes),
  );
}

export const mesmerAttributeRules = Object.freeze({
  modifyAttributes: applyMesmerAttributes,
  ...mesmerModifierHooks,
});

export {
  applyMesmerCoreAttributes,
  applyTroubadourAttributes,
  chronomancerModifierRules,
  compileMesmerModifierRules,
  mesmerCoreAttributeRules,
  mesmerCoreModifierRules,
  mirageModifierRules,
  troubadourModifierRules,
  virtuosoModifierRules,
};
