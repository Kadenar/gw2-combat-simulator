import { defineNativeModule } from "../../../../platform/gw2/native-profession.js";
import { createRangerModuleData } from "../../catalog-data.js";
import { soulbeastSkillHandlers } from "./handlers.js";
import { soulbeastAttributeRules, soulbeastCastRules } from "./rules.js";
import { SOULBEAST_BASE_SKILL_MECHANICS } from "./skills.js";
import { soulbeastState } from "./state.js";
import { bindSoulbeastUi } from "./ui.js";

export const soulbeastModule = defineNativeModule({
  id: "Soulbeast",
  data: createRangerModuleData("Soulbeast", {
    skillMechanics: SOULBEAST_BASE_SKILL_MECHANICS,
    handlers: soulbeastSkillHandlers,
  }),
  state: { scheduler: soulbeastState.create, resolver: soulbeastState.create },
  mechanics: {
    modifiers: soulbeastAttributeRules,
    castRules: soulbeastCastRules,
  },
  presentation: bindSoulbeastUi,
});
