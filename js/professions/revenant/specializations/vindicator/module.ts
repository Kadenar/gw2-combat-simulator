import { defineNativeModule } from "../../../../platform/gw2/native-profession.js";
import { createRevenantModuleData } from "../../catalog-data.js";
import { vindicatorSkillHandlers } from "./handlers.js";
import { vindicatorEventHandlers } from "./resolver.js";
import {
  vindicatorAttributeRules,
  vindicatorCastRules,
  vindicatorSchedulerHooks,
} from "./rules.js";
import { vindicatorState } from "./state.js";
import { vindicatorUi } from "./ui.js";
import {
  VINDICATOR_BASE_SKILL_MECHANICS,
  VINDICATOR_BALANCE_PROFILES,
} from "./skills.js";

export const vindicatorModule = defineNativeModule({
  id: "Vindicator",
  data: createRevenantModuleData("Vindicator", {
    skillMechanics: VINDICATOR_BASE_SKILL_MECHANICS,
    balanceProfiles: VINDICATOR_BALANCE_PROFILES,
    handlers: vindicatorSkillHandlers,
  }),
  state: {
    // scheduler and resolver each call create independently; they do not share a state object.
    scheduler: vindicatorState.create,
    resolver: vindicatorState.create,
  },
  mechanics: {
    modifiers: vindicatorAttributeRules,
    castRules: vindicatorCastRules,
    // Dodge strike emission is a scheduler hook, not a cast handler, because the strike fires in response to the dodge state event rather than directly inside the dodge cast.
    schedulerHooks: vindicatorSchedulerHooks,
    resolverHooks: {
      eventHandlers: vindicatorEventHandlers,
    },
  },
  presentation: vindicatorUi,
});
