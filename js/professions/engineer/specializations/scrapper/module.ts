import {
  afterSkillEffects,
  defineNativeModule,
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
import { createScrapperState } from "./state.js";
import { scrapperUi } from "./ui.js";

export const scrapperModule = defineNativeModule({
  id: "Scrapper",
  data: createEngineerModuleData("Scrapper", {
    skillMechanics: SCRAPPER_SKILL_MECHANICS,
    handlers: scrapperSkillHandlers,
  }),
  state: { scheduler: createScrapperState, resolver: createScrapperState },
  mechanics: {
    modifiers: scrapperAttributeRules,
    castRules: scrapperCastRules,
    castLifecycle: [afterSkillEffects(scrapperSchedulerHooks.afterCast)],
    reactions: [onResolvedDamage({
      id: "engineer.scrapper.damage",
      handler: scrapperEventReactions.damage,
    })],
    resolverHooks: {
      eventHandlers: scrapperEventHandlers,
      eventReactions: { buff: scrapperEventReactions.buff },
    },
  },
  presentation: scrapperUi,
});
