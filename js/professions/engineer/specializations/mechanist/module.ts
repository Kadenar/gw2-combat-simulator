import {
  afterSkillEffects,
  defineNativeModule,
  onResolvedDamage,
} from "../../../../platform/gw2/native-profession.js";
import { createEngineerModuleData } from "../../catalog-data.js";
import {
  mechanistEventReactions,
  mechanistSchedulerHooks,
  mechanistSkillHandlers,
} from "./handlers.js";
import { mechanistAttributeRules, mechanistCastRules } from "./rules.js";
import { MECHANIST_SKILL_MECHANICS } from "./skills.js";
import { mechanistState } from "./state.js";
import { mechanistUi } from "./ui.js";

const {
  afterCast: mechanistAfterCast,
  ...mechanistAdvancedSchedulerHooks
} = mechanistSchedulerHooks;

export const mechanistModule = defineNativeModule({
  id: "Mechanist",
  data: createEngineerModuleData("Mechanist", {
    skillMechanics: MECHANIST_SKILL_MECHANICS,
    handlers: mechanistSkillHandlers,
  }),
  state: { scheduler: mechanistState.create, resolver: mechanistState.create },
  mechanics: {
    modifiers: mechanistAttributeRules,
    castRules: mechanistCastRules,
    castLifecycle: [afterSkillEffects(mechanistAfterCast)],
    schedulerHooks: mechanistAdvancedSchedulerHooks,
    reactions: [onResolvedDamage({
      id: "engineer.mechanist.damage",
      handler: mechanistEventReactions.damage,
    })],
  },
  presentation: mechanistUi,
});
