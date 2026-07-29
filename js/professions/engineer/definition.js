// Engine-facing Engineer contract. Keep browser persistence, rendering, and
// build-to-simulation orchestration in app/app-definition.js.

import { defineProfession } from "../../platform/engine/profession.js";
import {
  createEngineerBuildDefaults,
  migrateEngineerBuild,
  validateEngineerBuild,
} from "./build.js";
import {
  engineerAttributeRules,
} from "./attribute-rules.js";
import { engineerCatalog } from "./catalog.js";
import {
  engineerCastRules,
  engineerSchedulerHooks,
} from "./mechanics/contract.js";
import {
  engineerResolverEventHandlers,
  engineerResolverEventReactions,
} from "./resolver/event-handlers.js";
import {
  createEngineerState,
  projectEngineerEndState,
  snapshotEngineerState,
} from "./state.js";
import { engineerUi } from "./ui.js";
import "./data/trait-coverage.js";

export const engineerProfession = defineProfession({
  id: "engineer",
  name: "Engineer",
  catalog: engineerCatalog,
  build: {
    createBuildDefaults: createEngineerBuildDefaults,
    migrateBuild: migrateEngineerBuild,
    validateBuild: validateEngineerBuild,
  },
  resources: {
    createProfessionState: createEngineerState,
    createResolverState: createEngineerState,
    projectEndState: projectEngineerEndState,
  },
  attributeRules: engineerAttributeRules,
  castRules: engineerCastRules,
  schedulerHooks: {
    ...engineerSchedulerHooks,
    snapshot: context => snapshotEngineerState(context.state.profession),
  },
  resolverHooks: {
    eventHandlers: engineerResolverEventHandlers,
    eventReactions: engineerResolverEventReactions,
  },
  ui: engineerUi,
});

export default engineerProfession;
