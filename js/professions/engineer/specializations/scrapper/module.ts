import { defineProfessionModule } from "../../../../platform/engine/profession.js";
import { engineerModuleCatalog } from "../../catalog.js";
import {
  scrapperEventHandlers,
  scrapperEventReactions,
  scrapperSchedulerHooks,
  scrapperSkillHandlers,
} from "./handlers.js";
import {
  scrapperAttributeRules,
  scrapperCastRules,
} from "./rules.js";
import { createScrapperState } from "./state.js";
import { scrapperUi } from "./ui.js";
import type { ScrapperState } from "../../types.js";

export const scrapperModule = defineProfessionModule<ScrapperState>({
  id: "Scrapper",
  catalog: {
    ...engineerModuleCatalog("Scrapper"),
    skillHandlers: scrapperSkillHandlers,
  },
  resources: {
    createProfessionState: createScrapperState,
    createResolverState: createScrapperState,
  },
  attributeRules: scrapperAttributeRules,
  castRules: scrapperCastRules,
  schedulerHooks: scrapperSchedulerHooks,
  resolverHooks: {
    eventHandlers: scrapperEventHandlers,
    eventReactions: scrapperEventReactions,
  },
  ui: scrapperUi,
});
