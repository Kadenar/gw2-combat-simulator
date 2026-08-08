import { defineNativeModule } from "../../../../platform/gw2/native-profession.js";
import { createRangerModuleData } from "../../catalog-data.js";
import { untamedSkillHandlers } from "./handlers.js";
import { untamedAttributeRules, untamedCastRules } from "./rules.js";
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
  },
  presentation: bindUntamedUi,
});
