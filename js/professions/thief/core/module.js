import { defineProfessionModule } from "../../../platform/engine/profession.js";
import { thiefModuleCatalog } from "../catalog.js";
import {
  thiefCoreSkillHandlers,
} from "./handlers.js";
import {
  thiefCoreResolverEventHandlers,
  thiefCoreResolverEventReactions,
} from "./resolver.js";
import {
  thiefCoreAttributeRules,
  thiefCoreCastRules,
  thiefCoreSchedulerHooks,
} from "./rules.js";
import {
  createThiefCoreState,
  projectThiefEndState,
} from "./state.js";
import { thiefCoreUi } from "./ui.js";

export const thiefCoreModule = defineProfessionModule({
  id: "Core",
  catalog: {
    ...thiefModuleCatalog("Core"),
    skillHandlers: thiefCoreSkillHandlers,
  },
  resources: {
    createProfessionState: createThiefCoreState,
    createResolverState: createThiefCoreState,
    projectEndState: projectThiefEndState,
  },
  attributeRules: thiefCoreAttributeRules,
  castRules: thiefCoreCastRules,
  schedulerHooks: thiefCoreSchedulerHooks,
  resolverHooks: {
    eventHandlers: thiefCoreResolverEventHandlers,
    eventReactions: thiefCoreResolverEventReactions,
  },
  ui: thiefCoreUi,
});
