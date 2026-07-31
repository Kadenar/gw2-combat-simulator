import { defineProfessionFamily } from "../../platform/engine/profession.js";
import {
  createThiefBuildDefaults,
  migrateThiefBuild,
  validateThiefBuild,
} from "./build.js";
import { thiefAttributeRules } from "./attribute-rules.js";
import { thiefCatalog } from "./catalog.js";
import { thiefCoreModule } from "./core/module.js";
import "./data/trait-coverage.js";
import {
  thiefCastRules,
  thiefSchedulerHooks,
} from "./mechanics/contract.js";
import {
  thiefResolverEventHandlers,
  thiefResolverEventReactions,
} from "./resolver.js";
import { antiquaryModule } from "./specializations/antiquary/module.js";
import { daredevilModule } from "./specializations/daredevil/module.js";
import { deadeyeModule } from "./specializations/deadeye/module.js";
import { specterModule } from "./specializations/specter/module.js";
import {
  createThiefState,
  projectThiefEndState,
} from "./state.js";
import { thiefUi } from "./ui.js";

export const thiefProfession = defineProfessionFamily({
  id: "thief",
  name: "Thief",
  catalog: thiefCatalog,
  build: {
    createBuildDefaults: createThiefBuildDefaults,
    migrateBuild: migrateThiefBuild,
    validateBuild: validateThiefBuild,
  },
  resources: {
    createProfessionState: createThiefState,
    createResolverState: createThiefState,
    projectEndState: projectThiefEndState,
  },
  attributeRules: thiefAttributeRules,
  castRules: thiefCastRules,
  schedulerHooks: thiefSchedulerHooks,
  resolverHooks: {
    eventHandlers: thiefResolverEventHandlers,
    eventReactions: thiefResolverEventReactions,
  },
  core: thiefCoreModule,
  specializations: {
    Daredevil: daredevilModule,
    Deadeye: deadeyeModule,
    Specter: specterModule,
    Antiquary: antiquaryModule,
  },
  ui: thiefUi,
});

export default thiefProfession;
