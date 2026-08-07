import {
  defineNativeModule,
  onFoodProcCreated,
  onResolvedDamage,
} from "../../../../platform/gw2/native-profession.js";
import { createRevenantModuleData } from "../../catalog-data.js";
import {
  renegadeEventHandlers,
  renegadeEventReactions,
  renegadeSkillHandlers,
} from "./handlers.js";
import {
  renegadeAttributeRules,
  renegadeCastRules,
  renegadeSchedulerHooks,
} from "./rules.js";
import { renegadeState } from "./state.js";
import { renegadeUi } from "./ui.js";
import { RENEGADE_BASE_SKILL_MECHANICS } from "./skills.js";

export const renegadeModule = defineNativeModule({
  id: "Renegade",
  data: createRevenantModuleData("Renegade", {
    skillMechanics: RENEGADE_BASE_SKILL_MECHANICS,
    handlers: renegadeSkillHandlers,
  }),
  state: { scheduler: renegadeState.create, resolver: renegadeState.create },
  mechanics: {
    modifiers: renegadeAttributeRules,
    castRules: renegadeCastRules,
    schedulerHooks: renegadeSchedulerHooks,
    reactions: [
      onResolvedDamage({
        id: "revenant.renegade.damage",
        handler: renegadeEventReactions.damage,
      }),
      onFoodProcCreated({
        id: "revenant.renegade.food-proc",
        handler: renegadeEventReactions.food_proc,
      }),
    ],
    resolverHooks: {
      eventHandlers: renegadeEventHandlers,
    },
  },
  presentation: renegadeUi,
});
