/**
 * Application-level attribute facade. Runtime rule ownership lives in Core
 * and the active specialization module.
 */
import {
  compileThiefModifierRules,
  thiefCoreAttributeRules,
  thiefCoreModifierRules,
} from "./core/rules.js";
import {
  antiquaryModifierRules,
} from "./specializations/antiquary/rules.js";
import {
  daredevilModifierRules,
} from "./specializations/daredevil/rules.js";
import {
  deadeyeModifierRules,
} from "./specializations/deadeye/rules.js";
import {
  specterModifierRules,
} from "./specializations/specter/rules.js";

export const thiefModifierRules = Object.freeze([
  ...thiefCoreModifierRules,
  ...daredevilModifierRules,
  ...deadeyeModifierRules,
  ...specterModifierRules,
  ...antiquaryModifierRules,
]);

export const thiefAttributeRules = Object.freeze({
  modifyAttributes: thiefCoreAttributeRules.modifyAttributes,
  ...compileThiefModifierRules(thiefModifierRules),
});
