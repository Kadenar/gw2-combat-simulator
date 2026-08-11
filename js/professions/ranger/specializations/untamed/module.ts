import {
  defineNativeModule,
  onResolvedControl,
  onResolvedDamage,
} from "../../../../platform/gw2/native-profession.js";
import { createRangerModuleData } from "../../catalog-data.js";
import { untamedSkillHandlers } from "./handlers.js";
import {
  untamedAttributeRules,
  untamedCastRules,
  untamedSchedulerHooks,
} from "./rules.js";
import {
  reactToUntamedControl,
  reactToUntamedDamage,
  untamedEventHandlers,
} from "./resolver.js";
import { UNTAMED_BASE_SKILL_MECHANICS } from "./skills.js";
import { untamedState } from "./state.js";
import { bindUntamedUi } from "./ui.js";

export const untamedModule = defineNativeModule({
  id: "Untamed",
  data: createRangerModuleData("Untamed", {
    skillMechanics: UNTAMED_BASE_SKILL_MECHANICS,
    handlers: untamedSkillHandlers,
  }),
  state: { scheduler: untamedState.create, resolver: untamedState.create },
  mechanics: {
    modifiers: untamedAttributeRules,
    castRules: untamedCastRules,
    schedulerHooks: untamedSchedulerHooks,
    resolverHooks: { eventHandlers: untamedEventHandlers },
    reactions: [
      onResolvedDamage({
        id: "ranger.untamed-damage",
        order: 20,
        handler: reactToUntamedDamage,
      }),
      onResolvedControl({
        id: "ranger.untamed-control",
        order: 20,
        handler: reactToUntamedControl,
      }),
    ],
  },
  presentation: bindUntamedUi,
});
