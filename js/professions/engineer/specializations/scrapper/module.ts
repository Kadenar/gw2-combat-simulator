import {
  afterSkillEffects,
  defineNativeModule,
  onBuffApplied,
  onResolvedDamage,
} from "../../../../platform/gw2/native-profession.js";
import { createEngineerModuleData } from "../../catalog-data.js";
import {
  scrapperEventHandlers,
  scrapperEventReactions,
  scrapperSchedulerHooks,
  scrapperSkillHandlers,
} from "./handlers.js";
import { scrapperAttributeRules, scrapperCastRules } from "./rules.js";
import { SCRAPPER_SKILL_MECHANICS } from "./skills.js";
import { scrapperState } from "./state.js";
import { scrapperUi } from "./ui.js";

export const scrapperModule = defineNativeModule({
  id: "Scrapper",
  data: createEngineerModuleData("Scrapper", {
    skillMechanics: SCRAPPER_SKILL_MECHANICS,
    handlers: scrapperSkillHandlers,
  }),
  state: { scheduler: scrapperState.create, resolver: scrapperState.create },
  mechanics: {
    modifiers: scrapperAttributeRules,
    castRules: scrapperCastRules,
    castLifecycle: [afterSkillEffects(scrapperSchedulerHooks.afterCast)],
    reactions: [
      onResolvedDamage({
        id: "engineer.scrapper.damage",
        handler: scrapperEventReactions.damage,
      }),
      onBuffApplied({
        id: "engineer.scrapper.buff",
        handler: scrapperEventReactions.buff,
      }),
    ],
    resolverHooks: {
      eventHandlers: scrapperEventHandlers,
    },
  },
  presentation: scrapperUi,
});
