import {
  defineNativeModule,
  onConditionApplied,
  onResolvedControl,
} from "../../../../platform/gw2/native-profession.js";
import { createRangerModuleData } from "../../catalog-data.js";
import { druidSkillHandlers } from "./handlers.js";
import {
  druidAttributeRules,
  druidCastRules,
  druidSchedulerHooks,
} from "./rules.js";
import { reactToDruidCondition, reactToDruidControl } from "./resolver.js";
import { DRUID_BASE_SKILL_MECHANICS } from "./skills.js";
import { druidState } from "./state.js";
import { druidUi } from "./ui.js";

export const druidModule = defineNativeModule({
  id: "Druid",
  data: createRangerModuleData("Druid", {
    skillMechanics: DRUID_BASE_SKILL_MECHANICS,
    handlers: druidSkillHandlers,
  }),
  state: { scheduler: druidState.create, resolver: druidState.create },
  mechanics: {
    modifiers: druidAttributeRules,
    castRules: druidCastRules,
    schedulerHooks: druidSchedulerHooks,
    reactions: [
      onResolvedControl({
        id: "ranger.druid-control",
        order: 20,
        handler: reactToDruidControl,
      }),
      onConditionApplied({
        id: "ranger.druid-condition",
        order: 20,
        handler: reactToDruidCondition,
      }),
    ],
  },
  presentation: druidUi,
});
