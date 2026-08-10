import {
  defineNativeModule,
  onResolvedDamage,
} from "../../../../platform/gw2/native-profession.js";
import { createGuardianModuleData } from "../../catalog-data.js";
import { willbenderEventReactions } from "./resolver.js";
import { WILLBENDER_SKILL_MECHANICS } from "./skills.js";
import { willbenderState } from "./state.js";
import { willbenderUi } from "./ui.js";

export const willbenderModule = defineNativeModule({
  id: "Willbender",
  data: createGuardianModuleData("Willbender", {
    skillMechanics: WILLBENDER_SKILL_MECHANICS,
  }),
  state: {
    scheduler: willbenderState.create,
    resolver: willbenderState.create,
  },
  mechanics: {
    reactions: willbenderEventReactions.damage.map(onResolvedDamage),
  },
  presentation: willbenderUi,
});
