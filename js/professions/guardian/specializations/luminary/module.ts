import {
  defineNativeModule,
  onResolvedDamage,
} from "../../../../platform/gw2/native-profession.js";
import { createGuardianModuleData } from "../../catalog-data.js";
import {
  luminaryEventHandlers,
  luminaryEventReactions,
  luminarySkillHandlers,
} from "./handlers.js";
import {
  luminaryAttributeRules,
  luminaryCastRules,
  luminarySchedulerHooks,
} from "./rules.js";
import { LUMINARY_SKILL_MECHANICS } from "./skills.js";
import { createLuminaryState } from "./state.js";
import { luminaryUi } from "./ui.js";

export const luminaryModule = defineNativeModule({
  id: "Luminary",
  data: createGuardianModuleData("Luminary", {
    skillMechanics: LUMINARY_SKILL_MECHANICS,
    handlers: luminarySkillHandlers,
  }),
  state: {
    scheduler: createLuminaryState,
    resolver: createLuminaryState,
  },
  mechanics: {
    modifiers: luminaryAttributeRules,
    castRules: luminaryCastRules,
    schedulerHooks: luminarySchedulerHooks,
    reactions: luminaryEventReactions.damage.map(onResolvedDamage),
    resolverHooks: { eventHandlers: luminaryEventHandlers },
  },
  presentation: luminaryUi,
});
