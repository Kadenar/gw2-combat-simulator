import { defineProfession } from "../../platform/engine/profession.js";
import {
  createThiefBuildDefaults,
  migrateThiefBuild,
  validateThiefBuild,
} from "./build.js";
import { thiefAttributeRules } from "./attribute-rules.js";
import { thiefCatalog } from "./catalog.js";
import {
  thiefCastRules,
  thiefSchedulerHooks,
} from "./mechanics/contract.js";
import {
  thiefResolverEventHandlers,
} from "./resolver/event-handlers.js";
import {
  createThiefState,
  projectThiefEndState,
  snapshotThiefState,
} from "./state.js";
import { thiefUi } from "./ui.js";
import "./data/trait-coverage.js";

export const thiefProfession = defineProfession({
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
  schedulerHooks: {
    ...thiefSchedulerHooks,
    snapshot: context => snapshotThiefState(context.state.profession),
  },
  resolverHooks: {
    eventHandlers: thiefResolverEventHandlers,
  },
  ui: thiefUi,
});

export default thiefProfession;
