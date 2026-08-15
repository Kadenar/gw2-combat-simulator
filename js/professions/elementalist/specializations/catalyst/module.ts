import {
  defineNativeModule,
  onComboResolved,
  onBuffApplied,
  onConditionApplied,
  onResolvedControl,
  onResolvedDamage,
} from "../../../../platform/gw2/native-profession.js";
import { createElementalistModuleData } from "../../catalog-data.js";
import {
  applyCatalystEmpowerment,
  applyCatalystResolvedDamage,
  applySteamshrieker,
  applyViciousEmpowerment,
} from "./resolver.js";
import {
  catalystAttributeRules,
  catalystCastRules,
  catalystSchedulerHooks,
} from "./rules.js";
import { createCatalystState } from "./state.js";
import { catalystUi } from "./ui.js";
import { CATALYST_SKILL_MECHANICS } from "./skills.js";

export const catalystModule = defineNativeModule({
  id: "Catalyst",
  data: createElementalistModuleData("Catalyst", {
    skillMechanics: CATALYST_SKILL_MECHANICS,
  }),
  state: { scheduler: createCatalystState, resolver: createCatalystState },
  mechanics: {
    modifiers: catalystAttributeRules,
    castRules: catalystCastRules,
    schedulerHooks: catalystSchedulerHooks,
    reactions: [
      onResolvedDamage({
        id: "elementalist.catalyst-shattering-ice",
        handler: applyCatalystResolvedDamage,
      }),
      onBuffApplied({
        id: "elementalist.catalyst-empowerment",
        handler: applyCatalystEmpowerment,
      }),
      onResolvedControl({
        id: "elementalist.catalyst-vicious-empowerment-control",
        handler: applyViciousEmpowerment,
      }),
      onConditionApplied({
        id: "elementalist.catalyst-vicious-empowerment-immobilize",
        handler: applyViciousEmpowerment,
      }),
      onComboResolved({
        id: "elementalist.catalyst-steamshrieker",
        handler: applySteamshrieker,
      }),
    ],
  },
  presentation: catalystUi,
});
