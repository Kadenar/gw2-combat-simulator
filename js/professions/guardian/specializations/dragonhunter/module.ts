import {
  defineNativeModule,
  onResolvedDamage,
} from "../../../../platform/gw2/native-profession.js";
import { createGuardianModuleData } from "../../catalog-data.js";
import { dragonhunterEventReactions } from "./handlers.js";
import { DRAGONHUNTER_SKILL_MECHANICS } from "./skills.js";
import { createDragonhunterState } from "./state.js";
import { dragonhunterUi } from "./ui.js";

export const dragonhunterModule = defineNativeModule({
  id: "Dragonhunter",
  data: createGuardianModuleData("Dragonhunter", {
    skillMechanics: DRAGONHUNTER_SKILL_MECHANICS,
  }),
  state: {
    scheduler: createDragonhunterState,
    resolver: createDragonhunterState,
  },
  mechanics: {
    reactions: dragonhunterEventReactions.damage.map(onResolvedDamage),
  },
  presentation: dragonhunterUi,
});
