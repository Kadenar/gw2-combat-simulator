import {
  defineNativeModule,
  onConditionApplied,
  onResolvedDamage,
} from "../../../platform/gw2/native-profession.js";
import { createElementalistModuleData } from "../catalog-data.js";
import {
  elementalistCoreAttributeRules,
  elementalistCoreCastRules,
  elementalistCoreSchedulerHooks,
} from "./rules.js";
import {
  createElementalistCoreState,
  projectElementalistEndState,
} from "./state.js";
import { bindElementalistCoreUi } from "./ui.js";
import {
  applyElementalistResolverAttunement,
  applyElementalistResolverComboField,
  applyElementalistResolverSignetFire,
  applyElementalistResolvedCondition,
  applyElementalistResolvedDamage,
} from "./resolver.js";

export const elementalistCoreModule = defineNativeModule({
  id: "Core",
  data: createElementalistModuleData("Core"),
  state: {
    scheduler: createElementalistCoreState,
    resolver: createElementalistCoreState,
    project: projectElementalistEndState,
  },
  mechanics: {
    modifiers: elementalistCoreAttributeRules,
    castRules: elementalistCoreCastRules,
    schedulerHooks: elementalistCoreSchedulerHooks,
    reactions: [
      onResolvedDamage({
        id: "elementalist.core.damage",
        handler: applyElementalistResolvedDamage,
      }),
      onConditionApplied({
        id: "elementalist.core.condition",
        handler: applyElementalistResolvedCondition,
      }),
    ],
    resolverHooks: {
      eventHandlers: {
        "elementalist.attunement": applyElementalistResolverAttunement,
        "elementalist.aura": () => {},
        "elementalist.combo-field": applyElementalistResolverComboField,
        "elementalist.combo": () => {},
        "elementalist.fresh-air": () => {},
        "elementalist.evasive-arcana": () => {},
        "elementalist.attunement-enter": () => {},
        "elementalist.signet-fire": applyElementalistResolverSignetFire,
      },
    },
  },
  presentation: bindElementalistCoreUi,
});
