import {
  afterSkillEffects,
  defineNativeModule,
  onBuffApplied,
  onResolvedDamage,
} from "../../../../platform/gw2/native-profession.js";
import { createEngineerModuleData } from "../../catalog-data.js";
import {
  scrapperResolverEventHandlers,
  scrapperResolverEventReactions,
} from "./resolver.js";
import {
  scrapperAttributeRules,
  scrapperCastRules,
  scrapperSchedulerHooks,
} from "./rules.js";
import { SCRAPPER_SKILL_MECHANICS } from "./skills.js";
import { scrapperState } from "./state.js";
import { scrapperUi } from "./ui.js";

export const scrapperModule = defineNativeModule({
  id: "Scrapper",
  data: createEngineerModuleData("Scrapper", {
    skillMechanics: SCRAPPER_SKILL_MECHANICS,
  }),
  state: { scheduler: scrapperState.create, resolver: scrapperState.create },
  mechanics: {
    modifiers: scrapperAttributeRules,
    castRules: scrapperCastRules,
    castLifecycle: [afterSkillEffects(scrapperSchedulerHooks.afterCast)],
    reactions: [
      onResolvedDamage({
        id: "engineer.scrapper.damage",
        handler: scrapperResolverEventReactions.damage,
      }),
      onBuffApplied({
        id: "engineer.scrapper.buff",
        handler: scrapperResolverEventReactions.buff,
      }),
    ],
    resolverHooks: {
      eventHandlers: scrapperResolverEventHandlers,
    },
  },
  presentation: scrapperUi,
});
