import {
  defineNativeModule,
  onResolvedDamage,
} from "../../../../platform/gw2/native-profession.js";
import { createGuardianModuleData } from "../../catalog-data.js";
import { willbenderEventReactions } from "./handlers.js";
import { WILLBENDER_SKILL_MECHANICS } from "./skills.js";
import { createWillbenderState } from "./state.js";
import { willbenderUi } from "./ui.js";

export const willbenderModule = defineNativeModule({
  id: "Willbender",
  data: createGuardianModuleData("Willbender", {
    skillMechanics: WILLBENDER_SKILL_MECHANICS,
  }),
  state: {
    scheduler: createWillbenderState,
    resolver: createWillbenderState,
  },
  mechanics: {
    reactions: willbenderEventReactions.damage.map(onResolvedDamage),
  },
  presentation: willbenderUi,
});
